import React from 'react';
import MonacoEditor from '@monaco-editor/react';

interface EditorProps {
  code: string;
  onCodeChange: (newCode: string) => void;
  language?: string;
  height?: string | number;
  className?: string;
  isReadOnly?: boolean;
}

export default function Editor({ 
  code, 
  onCodeChange, 
  language = 'javascript',
  height = '100%',
  className = '',
  isReadOnly = false
}: EditorProps) {
  return (
    <div className={`rounded-lg overflow-hidden h-full ${className}`}>
      <MonacoEditor
        height="100%"
        language={language}
        value={code}
        onChange={(value) => onCodeChange(value ?? '')}
        theme="vs-dark"
        beforeMount={(monaco) => {
          monaco.editor.defineTheme('navy-theme', {
            base: 'vs-dark',
            inherit: true,
            rules: [
              { token: '', foreground: 'E2E8F0', background: '001F3F' },
              { token: 'comment', foreground: '6B7280' },
              { token: 'string', foreground: '10B981' },
              { token: 'keyword', foreground: '3B82F6' },
              { token: 'number', foreground: 'F59E0B' },
              { token: 'delimiter.bracket', foreground: 'E2E8F0' },
              { token: 'delimiter', foreground: '9CA3AF' },
            ],
            colors: {
              'editor.background': '#001F3F',
              'editor.foreground': '#E2E8F0',
              'editor.lineHighlightBackground': '#002B4F',
              'editor.lineHighlightBorder': '#003366',
              'editorCursor.foreground': '#3B82F6',
              'editor.selectionBackground': '#1E40AF',
              'editor.inactiveSelectionBackground': '#1E3A8A',
              'editor.selectionHighlightBackground': '#1E40AF40',
              'editorLineNumber.foreground': '#4B5563',
              'editorLineNumber.activeForeground': '#9CA3AF',
              'editorIndentGuide.background': '#1E3A8A',
              'editorIndentGuide.activeBackground': '#3B82F6',
              'editorBracketMatch.background': '#1E40AF80',
              'editorBracketMatch.border': '#3B82F6',
            }
          });
        }}
        onMount={(editor, monaco) => {
          monaco.editor.setTheme('navy-theme');
        }}
        options={{
          readOnly: isReadOnly,
          // Display
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: 'Fira Code, Menlo, Monaco, "Courier New", monospace',
          fontWeight: '400',
          lineNumbers: 'on',
          lineNumbersMinChars: 3,
          lineDecorationsWidth: 10,
          
          // Layout & Scrolling
          wordWrap: 'off',
          wrappingStrategy: 'advanced',
          wrappingIndent: 'none',
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          mouseWheelScrollSensitivity: 1,
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            alwaysConsumeMouseWheel: false,
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
          
          // Cursor & Selection
          cursorStyle: 'line',
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          cursorWidth: 2,
          
          // Language Features
          suggestOnTriggerCharacters: true,
          quickSuggestions: {
            other: true,
            comments: false,
            strings: true
          },
          wordBasedSuggestions: 'off',
          
          // Bracket & Indentation
          matchBrackets: 'always',
          bracketPairColorization: {
            enabled: true,
            independentColorPoolPerBracketType: true
          },
          guides: {
            bracketPairs: true,
            highlightActiveBracketPair: true,
            indentation: true
          },
          
          // Editor Features
          automaticLayout: true,
          folding: true,
          formatOnPaste: true,
          formatOnType: true,
          renderWhitespace: 'selection',
          renderLineHighlight: 'all',
          fixedOverflowWidgets: true,
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          
          // Typing & Formatting
          tabSize: 2,
          insertSpaces: true,
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          
          // UI
          colorDecorators: true,
          padding: {
            top: 16,
            bottom: 16
          }
        }}
      />
    </div>
  );
}
