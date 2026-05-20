import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Pagination } from "../components/ui/pagination";

const meta: Meta<typeof Pagination> = {
  title: "UI/Pagination",
  component: Pagination,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Minimal pagination control with prev/next buttons and page indicator. Renders nothing when pageCount <= 1."
      }
    }
  }
};

export default meta;
type Story = StoryObj<typeof Pagination>;

export const FirstPage: Story = {
  args: { page: 1, pageCount: 5, onPageChange: () => {} }
};

export const MiddlePage: Story = {
  args: { page: 3, pageCount: 5, onPageChange: () => {} }
};

export const LastPage: Story = {
  args: { page: 5, pageCount: 5, onPageChange: () => {} }
};

export const SinglePage: Story = {
  args: { page: 1, pageCount: 1, onPageChange: () => {} },
  parameters: {
    docs: {
      description: {
        story: "Renders nothing when there's only one page."
      }
    }
  }
};

/** Interactive demo with state */
function InteractiveDemo() {
  const [page, setPage] = React.useState(1);
  return (
    <div className="space-y-4">
      <p className="text-sm text-fg-muted">
        Showing items {(page - 1) * 10 + 1}–{Math.min(page * 10, 47)} of 47
      </p>
      <Pagination page={page} pageCount={5} onPageChange={setPage} />
    </div>
  );
}

export const Interactive: Story = {
  render: () => <InteractiveDemo />
};
