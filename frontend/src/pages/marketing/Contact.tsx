import { useState, type FormEvent } from "react";
import { CheckCircle2, Mail, MapPin, MessageSquare, Send } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Field, Input, Textarea } from "../../components/ui/Form";
import { Eyebrow, H2, Section } from "./landingShared";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "Sales question", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = "Please enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Enter a valid email address.";
    if (form.message.trim().length < 10) next.message = "Please write at least a sentence so we can help.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSending(true);
    // Demo form: simulate async submit — no backend mailer on this project.
    window.setTimeout(() => {
      setSending(false);
      setSent(true);
    }, 700);
  };

  return (
    <>
      <Section className="pt-16 sm:pt-20">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <Eyebrow>Contact</Eyebrow>
            <H2>Talk to a human</H2>
            <p className="mt-4 max-w-lg text-muted">
              Questions about the product, a bug you found, or ideas for the roadmap? We read everything.
            </p>

            {sent ? (
              <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
                <h3 className="mt-3 text-lg font-semibold text-ink">Message ready to send</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                  This demo project doesn't deliver messages, but your form passed validation. In production this would reach the team inbox instantly.
                </p>
                <Button variant="outline" className="mt-5" onClick={() => { setSent(false); setForm({ name: "", email: "", subject: "Sales question", message: "" }); }}>
                  Send another
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Your name" htmlFor="c-name" required error={errors.name}>
                    <Input id="c-name" placeholder="Alex Morgan" value={form.name} onChange={set("name")} />
                  </Field>
                  <Field label="Work email" htmlFor="c-email" required error={errors.email}>
                    <Input id="c-email" type="email" placeholder="you@company.com" value={form.email} onChange={set("email")} />
                  </Field>
                </div>
                <Field label="Topic" htmlFor="c-subject">
                  <select id="c-subject" className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-ink" value={form.subject} onChange={set("subject")}>
                    <option>Sales question</option>
                    <option>Technical support</option>
                    <option>Feature request</option>
                    <option>Partnership</option>
                  </select>
                </Field>
                <Field label="Message" htmlFor="c-message" required error={errors.message}>
                  <Textarea id="c-message" rows={5} placeholder="Tell us what you need…" value={form.message} onChange={set("message")} />
                </Field>
                <Button type="submit" loading={sending} leftIcon={<Send className="h-4 w-4" />}>Send message</Button>
              </form>
            )}
          </div>

          <div className="space-y-4">
            <Eyebrow>Direct channels</Eyebrow>
            {[
              { icon: Mail, title: "Email", lines: ["hello@nexora.app", "Replies within 1 business day"] },
              { icon: MessageSquare, title: "Live demo help", lines: ["Use the demo account on the login page", "Explore goals, reports and team management"] },
              { icon: MapPin, title: "Based in", lines: ["San Francisco, California", "Working with teams worldwide"] },
            ].map((c) => (
              <div key={c.title} className="flex gap-4 rounded-2xl border border-border bg-card p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400">
                  <c.icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-ink">{c.title}</h3>
                  {c.lines.map((l) => <p key={l} className="mt-0.5 text-sm text-muted">{l}</p>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}
