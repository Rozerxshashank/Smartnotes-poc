import { ReactRenderer } from '@tiptap/react'
import tippy, { Instance as TippyInstance } from 'tippy.js'
import { MentionList } from './MentionList'
import { Note } from '../types'

export const getSuggestionConfig = (notes: Note[]) => {
  return {
    char: '[[',
    allowedPrefixes: [' ', '\n', ''],
    items: ({ query }: { query: string }) => {
      return notes
        .map(n => n.title)
        .filter(title => title.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 5)
    },
    render: () => {
      let component: ReactRenderer<any>
      let popup: TippyInstance[]

      return {
        onStart: (props: any) => {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          })

          if (!props.clientRect) {
            return
          }

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          })
        },

        onUpdate(props: any) {
          component.updateProps(props)

          if (!props.clientRect) {
            return
          }

          popup[0].setProps({
            getReferenceClientRect: props.clientRect,
          })
        },

        onKeyDown(props: any) {
          if (props.event.key === 'Escape') {
            popup[0].hide()
            return true
          }

          return component.ref?.onKeyDown(props)
        },

        onExit() {
          if (popup && popup.length > 0) {
              popup[0].destroy()
          }
          if (component) {
              component.destroy()
          }
        },
      }
    },
  }
}

