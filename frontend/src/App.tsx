import { useEffect, useState } from 'react';
import { useUID } from './hooks/useUID';
import ReceiptList from './components/receipt-list';
import ReceiptUpload from './components/receipt-upload';
import Logo from './components/logo'; // Assuming logo was copied
import { Button } from './components/ui/button';
import { Card, CardContent } from './components/ui/card';
import { Input } from './components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './components/ui/dialog';

function App() {
  const { uid, overrideUid } = useUID();
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recoveryUid, setRecoveryUid] = useState('');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const fetchReceipts = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
      const res = await fetch(`${API_BASE_URL}/api/receipts`, {
        headers: { 'X-User-ID': uid }
      });
      if (res.ok) {
        const data = await res.json();
        setReceipts(data.receipts || []);
      }
    } catch (err) {
      console.error('Failed to fetch receipts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [uid]);

  const handleDelete = async (id: string) => {
    if (!uid) return;
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
      const res = await fetch(`${API_BASE_URL}/api/receipts/${id}`, {
        method: 'DELETE',
        headers: { 'X-User-ID': uid }
      });
      if (res.ok) {
        fetchReceipts();
      }
    } catch (err) {
      console.error('Failed to delete', err);
    }
  };

  const handleRestore = () => {
    if (recoveryUid.trim().length > 10) {
      overrideUid(recoveryUid.trim());
      setIsProfileOpen(false);
      setRecoveryUid('');
    }
  };

  if (!uid) return <div className="p-8 text-center text-muted-foreground animate-pulse">Initializing Local ID...</div>;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-foreground transition-colors duration-200 selection:bg-primary selection:text-primary-foreground">
      <header className="sticky top-0 z-50 w-full border-b backdrop-blur-md bg-background/80 supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="font-bold text-xl tracking-tight hidden sm:inline-block">ReceiptRocket</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
             <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
               <DialogTrigger asChild>
                 <Button variant="outline">Settings / Profile</Button>
               </DialogTrigger>
               <DialogContent>
                 <DialogHeader>
                   <DialogTitle>Account Settings</DialogTitle>
                 </DialogHeader>
                 <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                       <p className="text-sm text-muted-foreground">This is your Anonymous UID. If you use a different device, paste this UID there to restore your receipts.</p>
                       <code className="block p-3 rounded bg-muted text-xs break-all cursor-text select-all">
                        {uid}
                       </code>
                    </div>
                    <div className="border-t pt-4 space-y-2 mt-4">
                       <h3 className="font-semibold text-sm">Restore from another device</h3>
                       <div className="flex gap-2">
                         <Input 
                            placeholder="Paste UID here" 
                            value={recoveryUid} 
                            onChange={(e) => setRecoveryUid(e.target.value)}
                          />
                         <Button onClick={handleRestore}>Restore</Button>
                       </div>
                    </div>
                 </div>
               </DialogContent>
             </Dialog>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl space-y-8">
         {/* Main content grid */}
         <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 flex flex-col space-y-8 order-2 lg:order-1">
               {loading ? (
                  <Card className="shadow-lg"><CardContent className="h-64 flex items-center justify-center animate-pulse"><p>Loading Receipts...</p></CardContent></Card>
               ) : (
                 <ReceiptList receipts={receipts} onDeleteReceipt={handleDelete} />
               )}
            </div>

            <div className="lg:col-span-4 flex flex-col space-y-8 order-1 lg:order-2">
              <div className="sticky top-24">
                  <Card className="shadow-xl border-primary/20 bg-card/50 backdrop-blur-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                    <CardContent className="p-6">
                      <ReceiptUpload onUploadSuccess={fetchReceipts} />
                    </CardContent>
                  </Card>
              </div>
            </div>
         </div>
      </main>
    </div>
  );
}

export default App;
