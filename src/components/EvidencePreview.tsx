import { useState } from 'react'
import { Button, ClassChip, Icon, Modal, OriginChip, RetrievalChip } from './ui'
import { fmtDate, type Evidence } from '../lib/store'
import { toast } from '../lib/toast'

export default function EvidencePreview({
  evidence,
  refLabel,
  onClose,
}: {
  evidence: Evidence
  refLabel?: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const isTinyFish = evidence.provider === 'tinyfish' || evidence.origin === 'live-source'

  const copySummary = () => {
    if (evidence.summary) {
      navigator.clipboard.writeText(evidence.summary)
      setCopied(true)
      toast('success', 'Evidence quote copied to clipboard.')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Modal title="Clinical Evidence Source Details" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-heading">{evidence.title}</h3>
            {isTinyFish && (
              <span className="inline-flex items-center gap-1 rounded bg-purple-100 dark:bg-purple-950/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-800 dark:text-purple-300">
                <Icon name="link" size={10} /> TinyFish Crawler
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted">
            Publisher: <strong className="text-fg">{evidence.publisher || 'Unknown Publisher'}</strong>
            {refLabel ? ` · Reference: ${refLabel}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ClassChip value={evidence.classification} />
          <OriginChip origin={evidence.origin} />
          <RetrievalChip state={evidence.retrieval} />
        </div>

        <dl className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-sage/40 p-3 text-xs">
          <div>
            <dt className="text-muted font-medium">Publication Date</dt>
            <dd className="tabular font-semibold text-heading mt-0.5">
              {evidence.published ? fmtDate(evidence.published) : 'Date not published'}
            </dd>
          </div>
          <div>
            <dt className="text-muted font-medium">Retrieval Timestamp</dt>
            <dd className="tabular font-semibold text-heading mt-0.5">
              {evidence.retrievedAt
                ? new Date(evidence.retrievedAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : 'Not recorded'}
            </dd>
          </div>
        </dl>

        <div>
          <div className="flex items-center justify-between pb-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              {isTinyFish ? 'Verbatim Extracted Policy Text' : 'Evidence Summary'}
            </p>
            {evidence.summary && (
              <button
                type="button"
                onClick={copySummary}
                className="inline-flex items-center gap-1 text-xs font-semibold text-info hover:underline"
              >
                <Icon name={copied ? 'check' : 'file'} size={12} />
                {copied ? 'Copied' : 'Copy Quote'}
              </button>
            )}
          </div>
          <div className="rounded-lg border border-line bg-card p-3.5 text-xs leading-relaxed text-fg shadow-xs">
            {evidence.summary || 'No quote or summary text available for this source.'}
          </div>
        </div>

        {evidence.verifies && (
          <div className="rounded-lg border border-line bg-sage/30 p-3 text-xs">
            <span className="font-semibold text-heading">Policy verification focus: </span>
            <span className="text-muted">{evidence.verifies}</span>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted pb-1">
            Canonical Source URL
          </p>
          <p className="tabular break-all font-mono text-xs rounded-md border border-line bg-sage/30 p-2 text-primary">
            {evidence.url}
          </p>
        </div>

        <div className="flex justify-end gap-2.5 pt-2 border-t border-line">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          <a href={evidence.url} target="_blank" rel="noopener noreferrer">
            <Button variant="primary" size="sm">
              Open Canonical Source <Icon name="external" size={13} />
            </Button>
          </a>
        </div>
      </div>
    </Modal>
  )
}
