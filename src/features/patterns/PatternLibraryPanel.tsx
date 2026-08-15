import { Download, FolderOpen, Plus, Search, Star, Trash2, Upload } from 'lucide-react'
import { useRef } from 'react'
import { Panel } from '../../components/Panel'
import type { DrumPattern } from '../../models/pattern'
import type { PatternFilters } from '../../hooks/usePatternLibrary'

interface Props {
  patterns: DrumPattern[]
  totalCount: number
  selectedId: string
  filters: PatternFilters
  loading: boolean
  onFilters: (filters: PatternFilters) => void
  onSelect: (id: string) => void
  onCreate: () => void
  onImport: (files: FileList) => void
  onExportBackup: () => void
  onImportBackup: (file: File) => void
  onFavorite: (pattern: DrumPattern) => void
  onRemove: (id: string) => void
}

export function PatternLibraryPanel(props: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const backupInputRef = useRef<HTMLInputElement>(null)
  return (
    <Panel title="Pattern Library" className="pattern-library pattern-library--active">
      <input ref={inputRef} type="file" accept=".mid,.midi,audio/midi,audio/x-midi" multiple hidden onChange={(event) => { if (event.target.files?.length) props.onImport(event.target.files); event.target.value = '' }} />
      <input ref={backupInputRef} type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) props.onImportBackup(file); event.target.value = '' }} />
      <div className="library-actions">
        <button className="button button--secondary" onClick={props.onCreate}><Plus size={15} />New pattern</button>
        <button className="button button--secondary" onClick={() => inputRef.current?.click()}><FolderOpen size={15} />Import MIDI…</button>
        <button className="button button--quiet" onClick={props.onExportBackup}><Download size={15} />Export Library</button>
        <button className="button button--quiet" onClick={() => backupInputRef.current?.click()}><Upload size={15} />Import Library</button>
      </div>
      <div className="search-control"><Search size={15} /><input value={props.filters.search} onChange={(event) => props.onFilters({ ...props.filters, search: event.target.value })} placeholder="Search patterns…" /></div>
      <div className="filters">
        <select aria-label="BPM filter" value={props.filters.bpm} onChange={(event) => props.onFilters({ ...props.filters, bpm: event.target.value })}><option>Any</option><option>&lt;100</option><option>100–129</option><option>130+</option></select>
      </div>
      <label className="favorite-row"><Star size={15} /><span>Favorites only</span><input type="checkbox" checked={props.filters.favoritesOnly} onChange={(event) => props.onFilters({ ...props.filters, favoritesOnly: event.target.checked })} /></label>
      <div className="pattern-list" role="listbox" aria-label="Imported patterns">
        {props.loading ? <div className="empty-state"><span>Loading local library…</span></div> : props.patterns.length === 0 ? (
          <div className="empty-state empty-state--library"><FolderOpen size={38} /><strong>{props.totalCount ? 'No patterns match these filters' : 'No patterns yet'}</strong><span>{props.totalCount ? 'Adjust search or filters.' : 'Create an empty pattern or import a MIDI drum loop.'}</span></div>
        ) : props.patterns.map((pattern) => (
          <div key={pattern.id} role="option" aria-selected={props.selectedId === pattern.id} className={`pattern-row ${props.selectedId === pattern.id ? 'is-selected' : ''}`} onClick={() => props.onSelect(pattern.id)}>
            <button className="pattern-row__main" onClick={() => props.onSelect(pattern.id)}>
              <strong>{pattern.name}</strong>
              <span>{pattern.bpm} BPM · {pattern.bars} {pattern.bars === 1 ? 'bar' : 'bars'} · {pattern.timeSignature.join('/')}</span>
            </button>
            <button className={`icon-button ${pattern.favorite ? 'is-favorite' : ''}`} aria-label={`${pattern.favorite ? 'Remove' : 'Add'} ${pattern.name} ${pattern.favorite ? 'from' : 'to'} favorites`} onClick={(event) => { event.stopPropagation(); props.onFavorite(pattern) }}><Star size={14} fill={pattern.favorite ? 'currentColor' : 'none'} /></button>
            <button className="icon-button icon-button--danger" aria-label={`Delete ${pattern.name}`} onClick={(event) => { event.stopPropagation(); props.onRemove(pattern.id) }}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <footer className="mini-status"><span>{props.totalCount} {props.totalCount === 1 ? 'pattern' : 'patterns'}</span><span>{props.patterns.length} shown</span></footer>
    </Panel>
  )
}
