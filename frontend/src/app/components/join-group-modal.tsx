import { useState, useEffect } from 'react';
import { useApp } from '@/app/contexts/app-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Users, Hash, Loader2 } from 'lucide-react';
import type { Group } from '@/app/contexts/app-context';
import { toast } from 'sonner';

export function JoinGroupModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { joinGroup, fetchPublicGroups } = useApp();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [publicGroups, setPublicGroups] = useState<Group[]>([]);
  const [fetchingPublic, setFetchingPublic] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCode('');
      setError('');
      setFetchingPublic(true);
      fetchPublicGroups()
        .then(groups => setPublicGroups(groups))
        .catch(() => setError('Failed to load public groups'))
        .finally(() => setFetchingPublic(false));
    }
  }, [isOpen, fetchPublicGroups]);

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError('');
    try {
      await joinGroup(code.trim().toUpperCase());
      toast.success('Successfully joined the group!');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid join code');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinPublic = async (joinCode: string) => {
    setLoading(true);
    setError('');
    try {
      if (!joinCode) {
         throw new Error("This group doesn't have a join code yet!");
      }
      await joinGroup(joinCode);
      toast.success('Successfully joined the group!');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to join group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join a Group</DialogTitle>
          <DialogDescription>
            Enter a code to instantly dive in or browse public dining groups!
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="code" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="code">Enter Code</TabsTrigger>
            <TabsTrigger value="browse">Browse</TabsTrigger>
          </TabsList>

          <TabsContent value="code" className="pt-4 space-y-4">
            <form onSubmit={handleJoinByCode} className="space-y-4">
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="E.g. X9M4K2"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="pl-10 h-12 uppercase font-mono text-center tracking-widest text-lg"
                  maxLength={6}
                />
              </div>
              {error && <p className="text-sm text-destructive text-center">{error}</p>}
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 h-12"
                disabled={!code.trim() || loading}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Join Group'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="browse" className="pt-4">
             {error && <p className="text-sm text-destructive text-center mb-4">{error}</p>}
             {fetchingPublic ? (
               <div className="flex justify-center py-8">
                 <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
               </div>
             ) : publicGroups.length === 0 ? (
               <div className="text-center py-8 text-muted-foreground">
                 <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                 <p>No public groups available right now.</p>
               </div>
             ) : (
               <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                 {publicGroups.map(group => (
                   <div key={group.id} className="flex items-center justify-between p-3 border rounded-lg hover:shadow-md transition-shadow">
                     <div>
                       <h4 className="font-semibold">{group.name}</h4>
                       <p className="text-xs text-muted-foreground">
                         {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                       </p>
                     </div>
                     <Button 
                      size="sm" 
                      variant="secondary"
                      onClick={() => handleJoinPublic(group.joinCode || '')}
                      disabled={loading || !group.joinCode}
                     >
                       Join
                     </Button>
                   </div>
                 ))}
               </div>
             )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
