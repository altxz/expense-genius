import { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/constants';
import { CreditCard, PlusCircle, Trash2, Calendar } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface CreditCardRow {
  id: string;
  user_id: string;
  name: string;
  limit_amount: number;
  closing_day: number;
  due_day: number;
  created_at: string;
}

export default function CreditCardsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [cards, setCards] = useState<CreditCardRow[]>([]);
  const [expenses, setExpenses] = useState<{ credit_card_id: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', limit_amount: '', closing_day: '25', due_day: '10' });

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Current month billing period expenses
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    const [{ data: cardsData }, { data: expData }] = await Promise.all([
      supabase.from('credit_cards').select('*').eq('user_id', user.id).order('name'),
      supabase.from('expenses').select('credit_card_id, value').eq('user_id', user.id).eq('type', 'expense').not('credit_card_id', 'is', null).gte('date', firstOfMonth),
    ]);

    setCards((cardsData || []) as CreditCardRow[]);
    setExpenses((expData || []) as { credit_card_id: string; value: number }[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const usageByCard = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => {
      if (e.credit_card_id) {
        map[e.credit_card_id] = (map[e.credit_card_id] || 0) + e.value;
      }
    });
    return map;
  }, [expenses]);

  const handleAdd = async () => {
    if (!form.name.trim() || !form.limit_amount) {
      toast({ title: 'Erro', description: 'Preencha nome e limite.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('credit_cards').insert({
      user_id: user?.id,
      name: form.name.trim(),
      limit_amount: parseFloat(form.limit_amount),
      closing_day: parseInt(form.closing_day) || 25,
      due_day: parseInt(form.due_day) || 10,
    });
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Cartão adicionado!' });
      setForm({ name: '', limit_amount: '', closing_day: '25', due_day: '10' });
      setModalOpen(false);
      fetchData();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('credit_cards').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Cartão removido' });
      fetchData();
    }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><span className="text-muted-foreground">Carregando...</span></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-4 lg:p-8 space-y-6 overflow-auto">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Cartões de Crédito</h1>
                <p className="text-sm text-muted-foreground mt-1">Gerencie seus cartões e acompanhe faturas</p>
              </div>
              <Button onClick={() => setModalOpen(true)} className="gap-2 rounded-xl h-11 px-6 bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
                <PlusCircle className="h-5 w-5" />
                Novo Cartão
              </Button>
            </div>

            {loading ? (
              <p className="text-muted-foreground text-center py-12">Carregando...</p>
            ) : cards.length === 0 ? (
              <Card className="rounded-2xl">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">Nenhum cartão cadastrado</p>
                  <p className="text-sm mt-1">Adicione seu primeiro cartão de crédito.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {cards.map(card => {
                  const used = usageByCard[card.id] || 0;
                  const pct = card.limit_amount > 0 ? Math.min((used / card.limit_amount) * 100, 100) : 0;
                  const available = Math.max(card.limit_amount - used, 0);

                  return (
                    <Card key={card.id} className="rounded-2xl overflow-hidden">
                      <div className={`h-2 ${pct > 80 ? 'bg-destructive' : pct > 50 ? 'bg-yellow-500' : 'bg-green-500'}`} />
                      <CardContent className="p-5 space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                              <CreditCard className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-semibold">{card.name}</p>
                              <p className="text-xs text-muted-foreground">Limite: {formatCurrency(card.limit_amount)}</p>
                            </div>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-xl">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-2xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover cartão?</AlertDialogTitle>
                                <AlertDialogDescription>O cartão será removido mas as transações vinculadas serão mantidas.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(card.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">Remover</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Fatura atual</span>
                            <span className="font-semibold">{formatCurrency(used)}</span>
                          </div>
                          <Progress value={pct} className="h-2.5" />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{pct.toFixed(0)}% utilizado</span>
                            <span>Disponível: {formatCurrency(available)}</span>
                          </div>
                        </div>

                        <div className="flex gap-4 text-xs text-muted-foreground pt-1 border-t">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Fecha dia {card.closing_day}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Vence dia {card.due_day}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Add Card Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Novo Cartão de Crédito</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do cartão</Label>
              <Input placeholder="Ex: Nubank, ActivoBank" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label>Limite (R$)</Label>
              <Input type="number" step="0.01" min="0" placeholder="5000" value={form.limit_amount} onChange={e => setForm(f => ({ ...f, limit_amount: e.target.value }))} className="rounded-xl h-11" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Dia de fecho</Label>
                <Input type="number" min="1" max="31" value={form.closing_day} onChange={e => setForm(f => ({ ...f, closing_day: e.target.value }))} className="rounded-xl h-11" />
              </div>
              <div className="space-y-2">
                <Label>Dia de vencimento</Label>
                <Input type="number" min="1" max="31" value={form.due_day} onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))} className="rounded-xl h-11" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleAdd} disabled={saving} className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
              {saving ? 'Salvando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
