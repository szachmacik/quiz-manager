import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { CheckCircle, FileVideo, Link, RefreshCw, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function SubmitVideo() {
  const [form, setForm] = useState({
    participantName: "",
    participantEmail: "",
    videoUrl: "",
    videoSource: "direct_url" as const,
  });
  const [submitted, setSubmitted] = useState(false);

  const submit = trpc.videoVerification.submit.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (e) => toast.error(e.message),
  });

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <Card className="bg-slate-900 border-slate-700 max-w-md w-full">
          <CardContent className="py-12 text-center">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-400" />
            <h2 className="text-xl font-bold text-white mb-2">Nagranie przyjęte!</h2>
            <p className="text-slate-300 text-sm">
              Twoje nagranie zostało przesłane do weryfikacji. Organizator konkursu sprawdzi je i skontaktuje się z Tobą.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center">
          <FileVideo className="w-12 h-12 mx-auto mb-3 text-violet-400" />
          <h1 className="text-2xl font-bold text-white">Prześlij nagranie</h1>
          <p className="text-slate-400 text-sm mt-2">
            Prześlij link do nagrania wideo potwierdzającego samodzielne rozwiązanie quizu
          </p>
        </div>

        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="py-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Imię i nazwisko *</Label>
                <Input className="bg-slate-800 border-slate-600 text-white mt-1"
                  value={form.participantName}
                  onChange={e => setForm(f => ({ ...f, participantName: e.target.value }))}
                  placeholder="Jan Kowalski" />
              </div>
              <div>
                <Label className="text-slate-300">Adres email *</Label>
                <Input type="email" className="bg-slate-800 border-slate-600 text-white mt-1"
                  value={form.participantEmail}
                  onChange={e => setForm(f => ({ ...f, participantEmail: e.target.value }))}
                  placeholder="jan@example.pl" />
              </div>
            </div>

            <div>
              <Label className="text-slate-300">Źródło nagrania</Label>
              <Select value={form.videoSource} onValueChange={v => setForm(f => ({ ...f, videoSource: v as any }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="google_drive">Google Drive</SelectItem>
                  <SelectItem value="dropbox">Dropbox</SelectItem>
                  <SelectItem value="direct_url">Link bezpośredni</SelectItem>
                  <SelectItem value="email_attachment">Inny link</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-slate-300">Link do nagrania *</Label>
              <div className="relative mt-1">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input className="bg-slate-800 border-slate-600 text-white pl-9 font-mono text-sm"
                  value={form.videoUrl}
                  onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))}
                  placeholder="https://drive.google.com/file/..." />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Upewnij się, że link jest publiczny lub dostępny dla każdego z linkiem
              </p>
            </div>

            <Button
              className="w-full bg-violet-600 hover:bg-violet-700"
              disabled={!form.participantName || !form.participantEmail || !form.videoUrl || submit.isPending}
              onClick={() => submit.mutate({
                participantName: form.participantName,
                participantEmail: form.participantEmail,
                videoUrl: form.videoUrl,
                videoSource: form.videoSource,
              })}
            >
              {submit.isPending
                ? <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                : <Upload className="w-4 h-4 mr-2" />}
              Wyślij nagranie
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-600">
          Nagranie zostanie zweryfikowane przez organizatora konkursu
        </p>
      </div>
    </div>
  );
}
