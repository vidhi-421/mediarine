import { Button, Card, CardHeader, ClassChip, Icon, PageHeader } from '../components/ui'
import { replayOnboarding } from '../lib/onboarding'

const FAQ = [
  ['What does Medarina do?', 'It records healthcare claims under review, organizes the source evidence for each claim, and supports a reviewer in reaching a documented determination. It does not decide whether a claim is fraudulent.'],
  ['Why does retrieval show as Not configured?', 'Live source retrieval needs a TinyFish endpoint. Until one is saved in Settings, investigations can be recorded and evidence can be added manually, but no sources are retrieved automatically.'],
  ['What is TinyFish?', 'TinyFish is the web retrieval service Medarina uses to gather live sources for a claim. Medarina sends the claim, codes, and dates to your endpoint and lists the returned evidence. If the endpoint fails or times out after 20 seconds, the investigation shows Failed with the reason, and no results are invented.'],
  ['How do I export a report?', 'Open an investigation and choose View report. Print opens a clean print layout, and Export PDF downloads a file named Medarina-<case>.pdf.'],
  ['How do I tell sample data from real results?', 'Sample records carry a “Sample Investigation” label and use illustrative content only. They can be removed in Settings. Real investigations never display this label.'],
  ['What is the difference between live-source and AI-generated evidence?', 'Live source retrieval means the text came directly from a retrieved page. An AI-generated summary is a machine-written description that a reviewer should check against the original source.'],
  ['Where is my data stored?', 'Investigations, settings, and accounts are stored in this browser on this device. They are not synchronized to a server.'],
]

export default function Help() {
  return (
    <>
      <PageHeader title="Help & Support" desc="Guidance on the investigation workflow, evidence terminology, and data handling." action={<Button onClick={replayOnboarding}><Icon name="play" size={16} />Replay onboarding</Button>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Investigation workflow" />
            <ol className="space-y-4 p-5 text-sm">
              {[
                ['Submit the claim', 'Enter the claim statement, category, and any context or source URL under New Investigation.'],
                ['Retrieve sources', 'When a retrieval service is connected, sources are retrieved and listed with their provenance. Otherwise add evidence manually.'],
                ['Classify evidence', 'Each item is classified as a verified fact, unverified claim, conflicting evidence, or inconclusive.'],
                ['Record the review', 'Choose a review status and outcome, add reviewer notes, and follow the recommended next steps.'],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-mint text-xs font-semibold text-mint-fg">{i + 1}</span>
                  <div><p className="font-medium">{t}</p><p className="text-muted">{d}</p></div>
                </li>
              ))}
            </ol>
          </Card>
          <Card>
            <CardHeader title="Frequently asked questions" />
            <div className="divide-y divide-line">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group px-5 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">
                    {q}<Icon name="down" size={16} className="text-muted transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-2 text-sm text-muted">{a}</p>
                </details>
              ))}
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Evidence terminology" />
            <ul className="space-y-3 p-5 text-sm">
              {([['verified', 'Confirmed by a retrieved, citable source.'], ['unverified', 'Stated but not independently confirmed.'], ['conflicting', 'Sources disagree on a material point.'], ['inconclusive', 'Information is insufficient to conclude.']] as const).map(([k, d]) => (
                <li key={k} className="space-y-1"><ClassChip value={k} /><p className="text-muted">{d}</p></li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Contact" />
            <p className="p-5 text-sm text-muted">No support channel is configured for this deployment. Contact your administrator for assistance.</p>
          </Card>
        </div>
      </div>
    </>
  )
}
