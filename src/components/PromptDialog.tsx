import { useEffect, useRef, useState, type ReactNode } from 'react';

interface PromptState {
  title: string;
  initial: string;
  placeholder?: string;
  resolve: (value: string | null) => void;
}

/**
 * Styled replacement for window.prompt:
 *   const { ask, dialog } = usePrompt();
 *   const name = await ask('Floor name', 'Ground floor');  // null = cancelled
 * Render {dialog} once in the component tree.
 */
export function usePrompt(): { ask: (title: string, initial?: string, placeholder?: string) => Promise<string | null>; dialog: ReactNode } {
  const [state, setState] = useState<PromptState | null>(null);

  const ask = (title: string, initial = '', placeholder = '') =>
    new Promise<string | null>((resolve) => setState({ title, initial, placeholder, resolve }));

  const close = (value: string | null) => {
    state?.resolve(value);
    setState(null);
  };

  const dialog = state ? <PromptDialogInner key={state.title + state.initial} state={state} onClose={close} /> : null;
  return { ask, dialog };
}

function PromptDialogInner({ state, onClose }: { state: PromptState; onClose: (v: string | null) => void }) {
  const [value, setValue] = useState(state.initial);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = () => {
    if (value.trim()) onClose(value.trim());
  };

  return (
    <div className="modal-backdrop" onClick={() => onClose(null)}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3>{state.title}</h3>
        <input
          ref={inputRef}
          className="input"
          value={value}
          placeholder={state.placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') onClose(null);
          }}
        />
        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button className="btn" onClick={() => onClose(null)}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={!value.trim()}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
