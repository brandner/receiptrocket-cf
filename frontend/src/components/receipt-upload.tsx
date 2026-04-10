import { useEffect, useState, useRef } from 'react';
import { UploadCloud, X, FileText, CheckCircle, Camera, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useUID } from '@/hooks/useUID';

type ReceiptUploadProps = {
  onUploadSuccess: () => void;
};

export default function ReceiptUpload({ onUploadSuccess }: ReceiptUploadProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [uploadMode, setUploadMode] = useState<'upload' | 'camera'>('upload');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const { uid } = useUID();
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  useEffect(() => {
    if (uploadMode === 'camera' && hasCameraPermission === null) {
      const getCameraPermission = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          setCameraStream(stream);
          setHasCameraPermission(true);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (error) {
          console.error('Error accessing camera:', error);
          setHasCameraPermission(false);
          toast({
            variant: 'destructive',
            title: 'Camera Access Denied',
            description: 'Please enable camera permissions in your browser settings.',
          });
        }
      };
      getCameraPermission();
    } else if (uploadMode === 'upload' && cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
    }
  }, [uploadMode, hasCameraPermission, toast, cameraStream]);

  const resetForm = () => {
    setImagePreview(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (formRef.current) {
        formRef.current.reset();
    }
  }

  const handleProcessAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !uid) return;
    
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', selectedFile);
      
      const response = await fetch('http://localhost:8787/api/upload', {
        method: 'POST',
        headers: {
          'X-User-ID': uid
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload receipt');
      }

      toast({
        title: 'Success!',
        description: 'Receipt processed and saved successfully!',
        action: <CheckCircle className="text-green-500" />,
      });
      onUploadSuccess();
      resetForm();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleTakePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUri = canvas.toDataURL('image/jpeg');
        setImagePreview(dataUri);
        fetch(dataUri)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], 'receipt.jpg', { type: 'image/jpeg' });
            setSelectedFile(file);
          });
      }
    }
  };
  
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 text-center">Upload New Receipt</h2>

      <form ref={formRef} onSubmit={handleProcessAndSave} className="space-y-6">
        <Tabs value={uploadMode} onValueChange={(value) => setUploadMode(value as any)} className="w-full mb-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload"><UploadCloud className="mr-2 h-4 w-4" /> File Upload</TabsTrigger>
            <TabsTrigger value="camera"><Camera className="mr-2 h-4 w-4" /> Camera</TabsTrigger>
          </TabsList>
          <TabsContent value="upload">
              <div className="space-y-2">
              <Label htmlFor="photo-upload">Receipt Image</Label>
              <div className="relative flex justify-center items-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary transition-colors overflow-hidden">
                  {imagePreview && uploadMode === 'upload' ? (
                  <>
                      <img
                        src={imagePreview}
                        alt="Receipt preview"
                        className="object-contain w-full h-full p-2"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full shadow-lg"
                        onClick={(e) => {
                          e.preventDefault();
                          handleRemoveImage();
                        }}
                      >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Remove image</span>
                      </Button>
                  </>
                  ) : (
                  <div className="text-center absolute inset-0 flex flex-col items-center justify-center">
                      <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">
                      <span className="font-semibold text-primary">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 10MB</p>
                  </div>
                  )}
                  {(!imagePreview || uploadMode !== 'upload') && (
                    <Input
                      id="photo-upload"
                      name="photo"
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={handleFileChange}
                      ref={fileInputRef}
                    />
                  )}
              </div>
              </div>
          </TabsContent>
          <TabsContent value="camera">
              <div className="space-y-4">
              <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border">
                {imagePreview && uploadMode === 'camera' ? (
                  <>
                    <img src={imagePreview} alt="Captured receipt" className="object-contain w-full h-full" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full"
                      onClick={() => {
                        setImagePreview(null);
                        setSelectedFile(null);
                      }}
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span className="sr-only">Retake photo</span>
                    </Button>
                  </>
                ) : (
                  <>
                    <video ref={videoRef} className={cn("w-full h-full", { 'hidden': hasCameraPermission === false })} autoPlay muted playsInline />
                    <canvas ref={canvasRef} className="hidden" />
                    {hasCameraPermission === false && (
                      <Alert variant="destructive" className="m-4 mx-auto max-w-sm">
                        <AlertTitle>Camera Access Denied</AlertTitle>                        
                        <AlertDescription>
                          Please enable camera permissions to use this feature.
                        </AlertDescription>
                      </Alert>
                    )}
                    {hasCameraPermission === null && (
                       <div className="absolute inset-0 flex items-center justify-center">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                       </div>
                    )}
                  </>
                )}
              </div>
              {cameraStream && !imagePreview && (
                  <Button type="button" onClick={handleTakePhoto} className="w-full">
                      <Camera className="mr-2 h-4 w-4" />
                      Take Photo
                  </Button>
              )}
              </div>
          </TabsContent>
        </Tabs>
        
        <div className="flex justify-center">
           <Button type="submit" disabled={!selectedFile || isUploading} className="w-full sm:w-auto">
             {isUploading ? (
               <>
                 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                 Processing via API...
               </>
             ) : (
               <>
                 <FileText className="mr-2 h-4 w-4" />
                 Process & Save
               </>
             )}
           </Button>
        </div>
      </form>
    </div>
  );
}
