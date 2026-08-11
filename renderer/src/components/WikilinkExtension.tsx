import React from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';

// Basic extension just rendering a styled span for now.
// Autocomplete suggestion logic would be handled by @tiptap/suggestion.
export const WikilinkExtension = Node.create({
  name: 'wikilink',
  group: 'inline',
  inline: true,
  selectable: false,
  atom: true,

  addAttributes() {
    return {
      target: {
        default: null,
      },
      label: {
        default: null,
      }
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="wikilink"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'wikilink', class: 'wikilink' }), `[[${HTMLAttributes.label}]]`];
  },

  addNodeView() {
    return ReactNodeViewRenderer(WikilinkNodeView);
  },
});

const WikilinkNodeView = (props: any) => {
  return (
    <NodeViewWrapper as="span" className="wikilink" style={{ color: 'var(--color-accent)', cursor: 'pointer', textDecoration: 'underline' }}>
      [[{props.node.attrs.label}]]
    </NodeViewWrapper>
  );
};
