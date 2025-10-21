export interface CommandLineProps {
  context: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (command: string) => void;
}
