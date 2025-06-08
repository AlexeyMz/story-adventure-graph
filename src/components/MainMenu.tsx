import * as React from 'react';
import * as Reactodia from '@reactodia/workspace';

export function MainMenu(props: {
  onOpen: (sceneRulesJson: string) => void;
  onSave: () => string;
}) {
  const { onOpen, onSave } = props;
  const { overlay } = Reactodia.useWorkspace();
  return (
    <>
      <Reactodia.ToolbarActionOpen
        fileAccept='.json'
        onSelect={async file => {
          const task = overlay.startTask({title: 'Loading a graph from file'});
          try {
            const json = await file.text();
            onOpen(json);
          } catch (err) {
            task.setError(new Error(
              'Failed to load specified graph file.',
              { cause: err }
            ));
          } finally {
            task.end();
          }
        }}>
        Open graph from file
      </Reactodia.ToolbarActionOpen>
      <Reactodia.ToolbarActionSave mode='authoring'
        onSelect={() => {
          const jsonString = onSave();
          const blob = new Blob([jsonString], {type: 'application/json'});
          const downloadLink = document.createElement('a');
          const blobUrl = URL.createObjectURL(blob);
          downloadLink.href = blobUrl;
          downloadLink.download = 'scene_rules.json';
          downloadLink.click();
          URL.revokeObjectURL(blobUrl);
        }}>
        Apply changes and save the graph
      </Reactodia.ToolbarActionSave>
      <Reactodia.ToolbarActionClearAll />
      <Reactodia.ToolbarActionExport kind='exportRaster' />
      <Reactodia.ToolbarActionExport kind='exportSvg' />
      <Reactodia.ToolbarActionExport kind='print' />
    </>
  );
}
