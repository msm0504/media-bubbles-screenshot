const chromium = require('chrome-aws-lambda');
const { S3Client, PutObjectCommand } = require('aws-sdk');

async function getBrowserInstance() {
	return chromium.puppeteer.launch({
		args: chromium.args,
		executablePath: await chromium.executablePath,
		headless: true,
		defaultViewport: {
			width: process.env.VIEWPORT_WIDTH,
			height: process.env.VIEWPORT_HEIGHT
		},
		ignoreHTTPSErrors: true
	});
}

async function getImageBufferFromPage(page, pageToCapture) {
	await page.goto(pageToCapture);
	await page.waitForSelector(process.env.SELECTOR);
	const results = await page.$(process.env.SELECTOR);
	const boundingBox = await results?.boundingBox();
	return (results || page).screenshot({
		clip: {
			x: boundingBox?.x ?? 0,
			y: boundingBox?.y ?? 0,
			width: boundingBox?.width || process.env.VIEWPORT_WIDTH,
			height: process.env.SCREENSHOT_HEIGHT || process.env.VIEWPORT_HEIGHT
		}
	});
}

async function sendImagetoAws(imageKey, imageBuffer) {
	if (!imageKey || !imageBuffer) return;

	const client = new S3Client();
	const params = {
		Body: imageBuffer,
		Key: imageKey,
		Bucket: process.env.AWS_S3_BUCKET,
		ACL: 'public-read'
	};
	const commmand = new PutObjectCommand(params);
	await client.send(commmand);

	return;
}

async function takeScreenshot(pageToCapture, imageKey) {
	const result = { imageUrl: '' };
	let browser = null;
	let page = null;
	try {
		browser = await getBrowserInstance();
		page = await browser.newPage();
		const imageBuffer = await getImageBufferFromPage(page, pageToCapture);
		await sendImagetoAws(imageKey, imageBuffer);
		result.imageUrl = `http://s3-${process.env.AWS_S3_REGION}.amazonaws.com/${process.env.AWS_S3_BUCKET}/${imageKey}`;
	} catch (error) {
		result.error = error;
	} finally {
		if (page !== null) await page.close();
		if (browser !== null) await browser.close();
	}
	return result;
}

exports.handler = async function (event) {
	let body;
	let statusCode = 200;
	const headers = {
		'Content-Type': 'application/json'
	};

	switch (event.routeKey) {
		case 'PUT /take-screenshot': {
			const { pageToCapture, imageKey } = JSON.parse(event.body);
			if (!pageToCapture || !imageKey) {
				statusCode = 400;
				body = 'Request Body must contain pageToCapture and imageKey properties';
				break;
			}
			const output = await takeScreenshot(pageToCapture, imageKey);
			if (output.error) {
				statusCode = 500;
				body = output.error;
			} else {
				body = output;
			}
			break;
		}
		default:
			statusCode = 405;
			body = `Method ${event.routeKey} is not supported`;
	}

	return {
		statusCode,
		body,
		headers
	};
};
