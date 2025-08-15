import { useRef } from 'react';

export default function MessageEditor({ value, onChange, fields = [], disabled }) {
  const taRef = useRef(null);

  // sisipkan / bungkus selection
  const insertAtCursor = (before = '', after = '') => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? value.length;
    const end   = ta.selectionEnd   ?? value.length;
    const sel   = value.slice(start, end);
    const next  = value.slice(0, start) + before + sel + after + value.slice(end);
    onChange(next);

    // set caret setelah penyisipan
    const caretPos = start + before.length + sel.length + (after ? 0 : 0);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(caretPos, caretPos);
    });
  };

  const wrapSelection = (left, right) => insertAtCursor(left, right);

  const onBold   = () => wrapSelection('*', '*');
  const onItalic = () => wrapSelection('_', '_');

  const onInsertToken = (token) => {
    if (!token) return;
    // token dalam bentuk [field_name]
    const text = `[${token}]`;
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? value.length;
    const end   = ta.selectionEnd   ?? value.length;
    const next  = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    const caretPos = start + text.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(caretPos, caretPos);
    });
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center',
        background: '#f3f4f6', border: '1px solid #e5e7eb',
        borderRadius: 8, padding: 8, marginBottom: 6
      }}>
        <button type="button" onClick={onBold} disabled={disabled} title="Bold (wrap * *)">
          <b>B</b>
        </button>
        <button type="button" onClick={onItalic} disabled={disabled} title="Italic (wrap _ _)">
          <i>I</i>
        </button>

        {/* Dropdown token */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: '#374151' }}>Sisipkan token:</span>
          <select
            onChange={(e) => { onInsertToken(e.target.value); e.target.selectedIndex = 0; }}
            disabled={disabled || fields.length === 0}
            style={{ padding: '4px 6px' }}
          >
            <option value="">Pilih field…</option>
            {fields.map((f) => (
              <option key={f} value={f}>{`[${f}]`}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Textarea */}
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Tulis pesan di sini. Contoh: Halo **[fullname]**, dari _[asal_sekolah]_ kelas [kelas]."
        style={{ width: '100%', height: 120 }}
      />
    </div>
  );
}
