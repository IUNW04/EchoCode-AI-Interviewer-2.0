import React from 'react';
import MonacoEditor from '@monaco-editor/react';

interface EditorProps {
  code: string;
  onCodeChange: (newCode: string) => void;
  language?: string;
  height?: string | number;
  className?: string;
}

export default function Editor({ 
  code, 
  onCodeChange, 
  language = 'javascript',
  height = '600px',
  className = ''
}: EditorProps) {
  return (
    <div className={`bg-white rounded-lg shadow-lg overflow-hidden ${className}`}>
      <MonacoEditor
        height={height}
        language={language}
        value={code}
        onChange={(value) => onCodeChange(value ?? '')}
        theme="vs-light"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: 'Fira Code, Menlo, Monaco, "Courier New", monospace',
          fontWeight: '400',
          lineNumbers: 'on',
          wordWrap: 'off',
          wordBasedSuggestions: 'off',
          suggestOnTriggerCharacters: true,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
          },
          folding: true,
          lineNumbersMinChars: 3,
          tabSize: 2,
          insertSpaces: true,
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          formatOnPaste: true,
          formatOnType: true,
          renderWhitespace: 'selection',
          renderLineHighlight: 'all',
          fixedOverflowWidgets: true,
          lineDecorationsWidth: 10,
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          renderIndentGuides: true,
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
          // Disable word wrap for code to prevent incorrect line breaks
          wordWrap: 'off',
          wrappingStrategy: 'advanced',
          wrappingIndent: 'none',
          // Enable horizontal scrolling
          scrollbar: {
            alwaysConsumeMouseWheel: false,
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
          // Add padding to the editor content
          padding: {
            top: 16,
            bottom: 16
          },
          // Improve cursor and selection visibility
          cursorStyle: 'line',
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          cursorWidth: 2,
          // Smooth scrolling
          smoothScrolling: true,
          mouseWheelScrollSensitivity: 1,
          quickSuggestions: {
            other: true,
            comments: false,
            strings: true
          }
        }}
      />
    </div>
  );
}
