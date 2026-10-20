import { Button, ClassChip, Icon, Modal, OriginChip, RetrievalChip } from './ui'
import { fmtDate, type Evidence } from '../lib/store'

export default function EvidencePreview({ evidence, refLabel, onClose }: { evidence: Evidence; refLabel?: string; onClose: () => void }) {
  return (
    <Modal title="Evidence preview" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <h3 className="text-[15px] font-semibold text-heading">{evidence.title}</h3>
          <p className="mt-0.5 text-sm text-muted">{evidence.publisher}{refLabel ? ` · ${refLabel}` : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2"><ClassChip value={evidence.classification} /><OriginChip origin={evidence.origin} /><RetrievalChip state={evidence.retrieval} /></div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-xs text-muted">Publication date</dt><dd className="tabular">{evidence.published ? fmtDate(evidence.published) : 'Not available'}</dd></div>
          <div><dt className="text-xs text-muted">Retrieved</dt><dd className="tabular">{evidence.retrievedAt ? fmtDate(evidence.retrievedAt) : 'Not recorded'}</dd></div>
        </dl>
        <div>
          <p className="text-xs text-muted">{evidence.origin === 'ai-summary' ? 'AI-generated summary (verify against the source)' : 'Evidence summary'}</p>
          <p className="mt-1 rounded-md bg-sage p-3 text-sm">{evidence.summary || 'No summary available.'}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Source URL</p>
          <p className="tabular break-all text-sm">{evidence.url}</p>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <a href={evidence.url} target="_blank" rel="noopener noreferrer"><Button variant="primary">Open source<Icon name="external" size={14} /></Button></a>
        </div>
      </div>
    </Modal>
  )
}
