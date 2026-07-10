declare module 'react-native-markdown-display' {
  import { ComponentType, ReactNode } from 'react';
  import { TextStyle, ViewStyle } from 'react-native';

  export interface MarkdownProps {
    style?: Partial<Record<string, TextStyle | ViewStyle>>;
    mergeStyle?: boolean;
    children?: ReactNode;
  }

  const Markdown: ComponentType<MarkdownProps>;
  export default Markdown;
}
