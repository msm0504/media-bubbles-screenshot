const chromium = require('chrome-aws-lambda');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

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

	const client = new S3Client({
		credentials: {
			accessKeyId: process.env.AWS_S3_KEY || '',
			secretAccessKey: process.env.AWS_S3_SECRET || ''
		},
		region: process.env.AWS_S3_REGION
	});
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

exports.handler = async function takeResultScreenshot(pageToCapture, imageKey) {
	let imageUrl = '';
	let browser = null;
	let page = null;
	try {
		browser = await getBrowserInstance();
		page = await browser.newPage();
		const imageBuffer = await getImageBufferFromPage(page, pageToCapture);
		await sendImagetoAws(imageKey, imageBuffer);
		imageUrl = `http://s3-${process.env.AWS_S3_REGION}.amazonaws.com/${process.env.AWS_S3_BUCKET}/${imageKey}`;
	} catch (error) {
		console.log(error);
	} finally {
		if (page !== null) await page.close();
		if (browser !== null) await browser.close();
	}
	return imageUrl;
};
