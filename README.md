This Lambda function will take a screenshot of a given webpage and save the image to an AWS S3 bucket.

## Lambda Environment Variables

### For Screenshot

| Name              | Description                                                        |
| ----------------- | ------------------------------------------------------------------ |
| VIEWPORT_WIDTH    | viewport height                                                    |
| VIEWPORT_HEIGHT   | viewport width                                                     |
| SELECTOR          | CSS selector of section to screenshot, will default to entire page |
| SCREENSHOT_HEIGHT | height for screenshot, will default to viewport height             |

### For AWS S3

| Name          |
| ------------- |
| AWS_S3_BUCKET |

## Function Definition

### Input Parameters

| Name          | Type   | Description                      |
| ------------- | ------ | -------------------------------- |
| pageToCapture | string | URL of page to screenshot        |
| imageKey      | string | key for object to be added in S3 |

### Output

| Type            | Description                                                        |
| --------------- | ------------------------------------------------------------------ |
| Promise<string> | Promise will be resolved with the URL for the object created in S3 |
