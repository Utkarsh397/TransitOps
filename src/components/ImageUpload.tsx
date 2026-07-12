import { useState } from 'react';
import { uploadToCloudinary } from '../lib/cloudinary';
import { UploadCloud, X, Loader2 } from 'lucide-react';

interface ImageUploadProps {
  folder: string;
  onUploaded: (data: { url: string; publicId: string }) => void;
  label?: string;
  defaultPreview?: string;
  className?: string;
}

export default function ImageUpload({ 
  folder, 
  onUploaded, 
  label = "Upload Image", 
  defaultPreview,
  className = ""
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(defaultPreview || null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      setIsUploading(true);
      
      // Set local preview immediately for better UX
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);

      const result = await uploadToCloudinary(file, folder);
      onUploaded(result);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
      setPreview(defaultPreview || null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onUploaded({ url: '', publicId: '' });
  };

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      
      {error && (
        <p className="text-sm text-red-600 mb-2">{error}</p>
      )}

      {preview ? (
        <div className="relative inline-block w-full max-w-sm">
          <img 
            src={preview} 
            alt="Preview" 
            className="w-full h-48 object-cover rounded-lg border border-gray-200 shadow-sm" 
          />
          {isUploading && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-lg">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          )}
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 bg-white rounded-full p-1.5 shadow-md hover:bg-gray-100 transition-colors"
            disabled={isUploading}
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-full h-32 px-4 transition bg-white border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:border-indigo-400 hover:bg-gray-50 focus:outline-none">
          <span className="flex flex-col items-center space-y-2">
            <UploadCloud className="w-8 h-8 text-gray-400" />
            <span className="font-medium text-gray-600">
              Drop image here, or <span className="text-indigo-600 hover:underline">browse</span>
            </span>
          </span>
          <input 
            type="file" 
            className="hidden" 
            accept="image/*"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </label>
      )}
    </div>
  );
}
