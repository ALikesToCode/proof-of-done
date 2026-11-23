import React from 'react';
import { world } from './world';

/**
 * Stands in for @forge/react in page tests. Each UI Kit component becomes a plain
 * element named after it, so a test can read the text a person would see and press
 * the buttons. It checks the pages' own logic. How Jira draws them is not its concern.
 */

/** Elements handed over in a prop, such as the actions of a section message or the cells of a table. */
function elementsIn(value: unknown, depth = 0): React.ReactElement[] {
  if (depth > 5 || value === null || typeof value !== 'object') return [];
  if (React.isValidElement(value)) return [value];
  const items = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
  return items.flatMap((item) => elementsIn(item, depth + 1));
}

function component(name: string) {
  const Component = ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) =>
    React.createElement(
      name,
      props,
      children,
      ...elementsIn(props).map((element, index) => React.cloneElement(element, { key: `prop-${index}` })),
    );
  Component.displayName = name;
  return Component;
}

export const Box = component('Box');
export const Button = component('Button');
export const Checkbox = component('Checkbox');
export const CodeBlock = component('CodeBlock');
export const DynamicTable = component('DynamicTable');
export const EmptyState = component('EmptyState');
export const ErrorMessage = component('ErrorMessage');
export const Heading = component('Heading');
export const HelperMessage = component('HelperMessage');
export const Inline = component('Inline');
export const Label = component('Label');
export const Link = component('Link');
export const List = component('List');
export const ListItem = component('ListItem');
export const LoadingButton = component('LoadingButton');
export const Lozenge = component('Lozenge');
export const Modal = component('Modal');
export const ModalBody = component('ModalBody');
export const ModalFooter = component('ModalFooter');
export const ModalHeader = component('ModalHeader');
export const ModalTitle = component('ModalTitle');
export const ModalTransition = component('ModalTransition');
export const ProgressBar = component('ProgressBar');
export const RadioGroup = component('RadioGroup');
export const SectionMessage = component('SectionMessage');
export const SectionMessageAction = component('SectionMessageAction');
export const Select = component('Select');
export const Spinner = component('Spinner');
export const Stack = component('Stack');
export const Tab = component('Tab');
export const TabList = component('TabList');
export const TabPanel = component('TabPanel');
export const Tabs = component('Tabs');
export const Text = component('Text');
export const TextArea = component('TextArea');
export const Textfield = component('Textfield');
export const User = component('User');

export const xcss = (style: unknown): unknown => style;
export const useProductContext = (): { siteUrl: string } => ({ siteUrl: world().siteUrl });

/** What each page module handed to `ForgeReconciler.render`, in the order the modules loaded. */
export const rendered: React.ReactElement[] = [];

export default {
  render(element: React.ReactElement): void {
    rendered.push(element);
  },
};
