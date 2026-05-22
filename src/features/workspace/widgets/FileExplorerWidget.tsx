import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { WorkspaceButton, WorkspaceCatalogGrid, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';
import { createLocalFileRecord, formatLocalFileSize, generalUseFolderLabel, type LocalFileRecord, type LocalFolderEntry } from '../workspaceLocalFiles';

export function FileExplorerWidget({
  files,
  activeFileId,
  selectedFileId,
  folderEntries,
  folderPath,
  canBrowseFolder,
  onBrowseFiles,
  onBrowseFolder,
  onOpenPreview,
  onSelectFile,
  onClearFiles,
}: {
  files: LocalFileRecord[];
  activeFileId: string | null;
  selectedFileId: string | null;
  folderEntries: LocalFolderEntry[];
  folderPath: string | null;
  canBrowseFolder: boolean;
  onBrowseFiles: (files: FileList | File[]) => Promise<LocalFileRecord[]>;
  onBrowseFolder: () => void;
  onOpenPreview: (file: LocalFileRecord) => void;
  onSelectFile: (id: string | null) => void;
  onClearFiles: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeFile = files.find((record) => record.id === activeFileId) ?? null;
  const hasRealFolderEntries = folderEntries.length > 0;
  const folderTreeEntries: LocalFolderEntry[] = hasRealFolderEntries
    ? folderEntries
    : files.length
      ? files.map((record) => ({
          id: record.id,
          name: record.file.name,
          path: record.path,
          kind: 'file' as const,
          depth: 0,
          file: record.file,
        }))
      : [
          {
            id: 'general-use-folder',
            name: generalUseFolderLabel,
            path: generalUseFolderLabel,
            kind: 'directory' as const,
            depth: 0,
          },
        ];
  const visibleFolderPath = folderPath ?? generalUseFolderLabel;
  const loadedEntryCount = hasRealFolderEntries ? folderEntries.length : files.length;
  const selectedCountLabel = `${files.length} ${files.length === 1 ? 'item' : 'items'} loaded`;
  const explorerStatusLabel = activeFile
    ? `Previewing ${activeFile.path}`
    : folderEntries.length
      ? `Folder: ${visibleFolderPath}`
      : 'General use folder ready';
  const getFolderEntrySelectionId = (entry: LocalFolderEntry) => (entry.file ? createLocalFileRecord(entry.file).id : entry.id);

  const folderCatalogItems = folderTreeEntries.map((entry) => {
    const selectionId = getFolderEntrySelectionId(entry);

    return {
      id: selectionId,
      label: entry.path,
      note: entry.file ? `${entry.kind} - ${formatLocalFileSize(entry.file.size)}` : `${entry.kind} - no file access`,
      badge: entry.depth > 0 ? `depth ${entry.depth}` : entry.kind,
      active: selectionId === selectedFileId || selectionId === activeFileId,
      state: entry.kind,
    };
  });

  const selectedFileCatalogItems = files.map((record) => ({
    id: record.id,
    label: record.path,
    note: `${record.previewKind} - ${record.file.type || 'unknown type'}`,
    badge: formatLocalFileSize(record.file.size),
    active: record.id === selectedFileId || record.id === activeFileId,
    state: record.previewKind,
  }));

  const handleBrowseFilesClick = () => {
    fileInputRef.current?.click();
  };

  const handleBrowseFolderClick = () => {
    void onBrowseFolder();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    void onBrowseFiles(selectedFiles);
    event.target.value = '';
  };

  const handleFolderSelect = (entryId: string) => {
    const entry = folderTreeEntries.find((candidate) => getFolderEntrySelectionId(candidate) === entryId);
    if (!entry?.file) return;

    const fileRecord = createLocalFileRecord(entry.file);
    if (selectedFileId === fileRecord.id || activeFileId === fileRecord.id) {
      void onOpenPreview(fileRecord);
      return;
    }

    void onBrowseFiles([entry.file]);
    onSelectFile(fileRecord.id);
  };

  const handleSelectedFileSelect = (fileId: string) => {
    const record = files.find((candidate) => candidate.id === fileId);
    if (!record) return;

    if (selectedFileId === record.id || activeFileId === record.id) {
      void onOpenPreview(record);
      return;
    }

    onSelectFile(record.id);
  };

  return (
    <WorkspaceContentShell className="file-explorer-surface">
      <WorkspaceContentHeader
        className="file-explorer-head"
        eyebrow="Local file browser"
        title="Choose files or folders from this PC."
        metaEyebrow={selectedCountLabel}
        meta={explorerStatusLabel}
      />

      <WorkspaceSummaryPanel className="file-explorer-summary" title={loadedEntryCount ? `${loadedEntryCount} ${loadedEntryCount === 1 ? 'entry' : 'entries'}` : 'No entries loaded'}>
        Single-click selects; click again opens preview.
      </WorkspaceSummaryPanel>

      <WorkspaceSectionFrame className="file-explorer-toolbar-frame" eyebrow="file controls" title="local intake" meta="browse / clear">
        <div className="file-explorer-toolbar">
          <WorkspaceButton onClick={handleBrowseFilesClick}>
            Browse items
          </WorkspaceButton>
          <WorkspaceButton
            variant="secondary"
            onClick={handleBrowseFolderClick}
            disabled={!canBrowseFolder}
            title={canBrowseFolder ? 'Open a general-use folder picker' : 'Folder picker is not available in this browser'}
          >
            Open folder
          </WorkspaceButton>
          <WorkspaceButton variant="secondary" onClick={onClearFiles} disabled={!files.length && !folderEntries.length}>
            Clear loaded files
          </WorkspaceButton>
          <input
            ref={fileInputRef}
            className="file-explorer-input"
            type="file"
            multiple
            aria-hidden="true"
            tabIndex={-1}
            onChange={handleFileChange}
          />
        </div>
      </WorkspaceSectionFrame>

      <div className="file-explorer-body">
        {hasRealFolderEntries || files.length ? (
          <>
            <WorkspaceSectionFrame className="file-explorer-folder-tree" eyebrow={hasRealFolderEntries ? 'Folder tree' : 'Selected files'} meta={`${folderTreeEntries.length} items - depth ${Math.max(...folderTreeEntries.map((entry) => entry.depth), 0)}`}>
              <WorkspaceCatalogGrid
                className="file-explorer-catalog file-explorer-folder-catalog"
                variant="desktop"
                ariaLabel={hasRealFolderEntries ? 'Folder tree' : 'Selected files'}
                items={folderCatalogItems}
                onSelect={(item) => handleFolderSelect(item.id)}
              />
            </WorkspaceSectionFrame>

            {hasRealFolderEntries && files.length ? (
              <WorkspaceSectionFrame className="file-explorer-selection-frame" eyebrow="Selected local files" meta={`${files.length} item${files.length === 1 ? '' : 's'}`}>
                <WorkspaceCatalogGrid
                  className="file-explorer-catalog file-explorer-selection-catalog"
                  variant="desktop"
                  ariaLabel="Selected local files"
                  items={selectedFileCatalogItems}
                  onSelect={(item) => handleSelectedFileSelect(item.id)}
                />
              </WorkspaceSectionFrame>
            ) : null}
          </>
        ) : (
          <WorkspaceSummaryPanel className="file-explorer-empty-panel" title="General use folder ready.">
            Select files or open a folder from your PC, then click once to select an item and click it again to open it in the preview panel.
          </WorkspaceSummaryPanel>
        )}
      </div>
    </WorkspaceContentShell>
  );
}

