import { registerPlugin } from '@capacitor/core'

const capture = registerPlugin('ReportCapture')

export async function captureReportViewport() {
  const image = await capture.captureViewport()
  if (!image?.dataURL?.startsWith('data:image/jpeg;base64,') || image.width <= 0 || image.height <= 0) {
    throw new Error('Invalid native viewport screenshot')
  }
  return image.dataURL
}
