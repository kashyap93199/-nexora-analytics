import { useDocumentTitle } from "../../hooks/useUi";
import { useAuth } from "../../contexts/AuthContext";
import { Plug, Unplug } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/base";
import { Button } from "../../components/ui/Button";

// Brand glyphs rendered inline (open-source friendly, no external images).
const GLYPHS: Record<string, string> = {
  stripe: "S",
  shopify: "S",
  google: "G",
  slack: "#",
  mailchimp: "M",
  zapier: "Z",
};

const INTEGRATIONS = [
  { id: "stripe", name: "Stripe", color: "#635bff", category: "Payments", description: "Sync payments and reconcile revenue automatically." },
  { id: "shopify", name: "Shopify", color: "#95bf47", category: "Commerce", description: "Import products and orders from your store." },
  { id: "google", name: "Google Analytics", color: "#4285f4", category: "Traffic", description: "Combine site traffic with revenue analytics." },
  { id: "slack", name: "Slack", color: "#611f69", category: "Alerts", description: "Post weekly summaries and goal updates to a channel." },
  { id: "mailchimp", name: "Mailchimp", color: "#ffe01b", category: "Marketing", description: "Push VIP segments into campaigns automatically." },
  { id: "zapier", name: "Zapier", color: "#ff4f00", category: "Automation", description: "Connect Nexora to 5,000+ apps with no code." },
];

export default function IntegrationsPage() {
  useDocumentTitle("Integrations");
  const { me } = useAuth();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Integrations"
        description="Connect your tools to keep analytics in sync automatically."
      />
      <Card>
        <CardHeader title="Available integrations" subtitle="This demo build shows the integration catalog — connections are part of the roadmap" />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {INTEGRATIONS.map((integration) => {
            const textColor = ["mailchimp", "google"].includes(integration.id) ? "#0f172a" : "#ffffff";
            return (
              <div key={integration.id} className="flex flex-col rounded-xl border border-border p-4 transition hover:border-primary-300/70 dark:hover:border-primary-500/40">
                <div className="flex items-center justify-between">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-base font-bold shadow-sm"
                    style={{ background: integration.color, color: textColor }}
                    aria-hidden
                  >
                    {GLYPHS[integration.id]}
                  </span>
                  <Badge tone="gray">Demo</Badge>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-ink">{integration.name}</h3>
                <p className="mt-0.5 text-xs text-muted">{integration.category}</p>
                <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted">{integration.description}</p>
                <Button variant="outline" size="sm" className="mt-4 w-full" disabled title="Coming soon in the full product">
                  <Unplug className="h-3.5 w-3.5" /> Connect
                </Button>
              </div>
            );
          })}
        </div>
      </Card>
      <Card>
        <CardBody className="flex items-start gap-3 text-sm text-muted">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400">
            <Plug className="h-4 w-4" />
          </span>
          <div>
            <p className="font-medium text-ink">Demo note</p>
            <p className="mt-1 leading-relaxed">
              Connect buttons are intentionally disabled on this demo. In production, each card would launch an OAuth flow and write
              credentials to your organization's encrypted vault. <strong className="text-ink">{me?.organization.name}</strong> has no external
              connections configured.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
