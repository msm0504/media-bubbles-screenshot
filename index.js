const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

async function getBrowserInstance() {
	return puppeteer.launch({
		args: chromium.args,
		executablePath: await chromium.executablePath(),
		headless: chromium.headless,
		defaultViewport: {
			width: +process.env.VIEWPORT_WIDTH,
			height: +process.env.VIEWPORT_HEIGHT,
		},
		ignoreHTTPSErrors: true,
	});
}

async function getImageBufferFromPage(page, pageToCapture) {
	await page.goto(pageToCapture, { waitUntil: 'networkidle0' });
	await page.waitForSelector(process.env.SELECTOR);
	const results = await page.$(process.env.SELECTOR);
	if (!results) {
		throw new Error('Element not found on page');
	}
	const boundingBox = await results.boundingBox();
	const params = {
		clip: {
			x: boundingBox.x,
			y: boundingBox.y,
			width: Math.min(boundingBox.width, +process.env.VIEWPORT_WIDTH),
			height: Math.min(
				boundingBox.height,
				+process.env.SCREENSHOT_HEIGHT || +process.env.VIEWPORT_HEIGHT
			),
		},
	};
	return page.screenshot(params);
}

async function loadImageToS3(imageKey, imageBuffer) {
	if (!imageKey || !imageBuffer) return;

	const s3Client = new S3Client({ region: process.env.AWS_S3_REGION });
	const params = {
		Body: imageBuffer,
		Key: imageKey,
		Bucket: process.env.AWS_S3_BUCKET,
	};
	const commmand = new PutObjectCommand(params);
	return s3Client.send(commmand);
}

async function takeScreenshot(pageToCapture, imageKey) {
	const result = { imageUrl: '' };
	let browser = null;
	let page = null;
	try {
		browser = await getBrowserInstance();
		page = await browser.newPage();
		const imageBuffer = await getImageBufferFromPage(page, pageToCapture);
		await loadImageToS3(imageKey, imageBuffer);
		result.imagePath = `http://s3-${process.env.AWS_S3_REGION}.amazonaws.com/${process.env.AWS_S3_BUCKET}/${imageKey}`;
	} catch (error) {
		console.log(error);
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
		'Content-Type': 'application/json',
	};

	const { pageToCapture, imageKey } = event;
	if (!pageToCapture || !imageKey) {
		statusCode = 400;
		body = 'Request Body must contain pageToCapture and imageKey properties';
	} else {
		const output = await takeScreenshot(pageToCapture, imageKey);
		if (output.error) {
			statusCode = 500;
			body = output.error;
		} else {
			body = output;
		}
	}

	return {
		statusCode,
		headers,
		body: JSON.stringify(body),
	};
};
