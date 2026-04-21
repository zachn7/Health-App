import { aiProxySpeak, aiProxyTranscribe } from '@/lib/ai-proxy-client'

export async function startMicRecording(options?: { mimeType?: string }) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const recorder = new MediaRecorder(stream, { mimeType: options?.mimeType })

  const chunks: BlobPart[] = []
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data)
  }

  recorder.start()

  return {
    stop: () =>
      new Promise<{ blob: Blob; mimeType: string }>((resolve) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
          // stop tracks
          stream.getTracks().forEach((t) => t.stop())
          resolve({ blob, mimeType: recorder.mimeType || 'audio/webm' })
        }
        recorder.stop()
      }),
  }
}

export async function transcribeAudio(blob: Blob) {
  // Basic filename based on type.
  const ext = blob.type.includes('wav') ? 'wav' : blob.type.includes('opus') ? 'opus' : 'webm'
  return await aiProxyTranscribe(blob, `voice.${ext}`)
}

export async function speakText(text: string) {
  return await aiProxySpeak(text, { format: 'mp3' })
}
