import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileText, X, CheckCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import api from '@/config/api'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]

function uploadToSignedUrl(url, file, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', url)
    request.setRequestHeader('Content-Type', file.type)
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      onProgress(Math.round((event.loaded / event.total) * 100))
    }
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve()
        return
      }
      reject(new Error(`Upload failed with status ${request.status}`))
    }
    request.onerror = () => reject(new Error('Upload failed. Please try again.'))
    request.send(file)
  })
}

function validateFile(file) {
  if (!file) return false

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File must be 10MB or smaller.')
  }

  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Upload a PDF, DOCX, or TXT file.')
  }

  return true
}

function FileUpload({ onFileUploaded, onFileRemoved, onUploadingChange }) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const setUploadingState = useCallback(
    (value) => {
      setIsUploading(value)
      onUploadingChange?.(value)
    },
    [onUploadingChange]
  )

  const startUpload = useCallback(
    async (file) => {
      try {
        validateFile(file)
      } catch (error) {
        toast.error(error.message)
        return
      }

      setSelectedFile(file)
      setUploadProgress(0)
      setUploadingState(true)

      try {
        const { data } = await api.post('/generate/upload-url', {
          fileName: file.name,
          fileType: file.type,
        })

        await uploadToSignedUrl(data.uploadUrl, file, setUploadProgress)
        onFileUploaded?.({ file, fileKey: data.fileKey })
        toast.success('Document uploaded successfully.')
      } catch (error) {
        setSelectedFile(null)
        setUploadProgress(0)
        onFileRemoved?.()
        toast.error(error.response?.data?.error || error.message || 'Upload failed.')
      } finally {
        setUploadingState(false)
      }
    },
    [onFileRemoved, onFileUploaded, setUploadingState]
  )

  const handleDragOver = useCallback((event) => {
    event.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((event) => {
    event.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault()
      setIsDragging(false)

      const file = event.dataTransfer.files[0]
      if (file) {
        startUpload(file)
      }
    },
    [startUpload]
  )

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0]
    if (file) {
      startUpload(file)
    }
  }

  const removeFile = () => {
    setSelectedFile(null)
    setUploadProgress(0)
    setUploadingState(false)
    onFileRemoved?.()
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Or Upload a Document</label>

      <AnimatePresence mode="wait">
        {selectedFile ? (
          <motion.div
            key="selected"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex items-center gap-4 p-4 rounded-xl border border-green-500/30 bg-green-500/10"
          >
            <div className="h-12 w-12 rounded-lg bg-green-500/20 flex items-center justify-center">
              {isUploading ? (
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
              ) : (
                <CheckCircle className="h-6 w-6 text-green-500" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{selectedFile.name}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
                <span>•</span>
                <span>{isUploading ? `Uploading ${uploadProgress}%` : 'Ready to generate'}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-200"
                  style={{ width: `${isUploading ? uploadProgress : 100}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={removeFile}
              disabled={isUploading}
              className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-red-500" />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer',
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50 hover:bg-muted/50'
            )}
          >
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />

            <div className="flex flex-col items-center gap-3">
              <div
                className={cn(
                  'h-14 w-14 rounded-xl flex items-center justify-center transition-colors',
                  isDragging ? 'bg-primary/20' : 'bg-muted'
                )}
              >
                {isDragging ? (
                  <FileText className="h-7 w-7 text-primary" />
                ) : (
                  <Upload className="h-7 w-7 text-muted-foreground" />
                )}
              </div>

              <div>
                <p className="font-medium">
                  {isDragging ? 'Drop your file here' : 'Drag & drop or click to upload'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Supports PDF, DOCX, TXT (max 10MB)
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default FileUpload
