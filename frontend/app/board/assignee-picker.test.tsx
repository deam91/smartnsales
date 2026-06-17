import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssigneePicker } from "./board";

function mockFetch(results: { id: number; username: string }[]) {
  const fn = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results }) });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AssigneePicker", () => {
  it("debounces, queries by the typed term, and renders matching usernames", async () => {
    const fetchMock = mockFetch([{ id: 2, username: "nadia" }]);
    const user = userEvent.setup();
    render(<AssigneePicker onSelect={() => {}} />);

    await user.type(screen.getByRole("combobox"), "nad");
    expect(fetchMock).not.toHaveBeenCalled(); // not fired immediately (debounced)

    expect(await screen.findByRole("option", { name: "@nadia" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("search=nad");
  });

  it("calls onSelect with the chosen user", async () => {
    mockFetch([{ id: 2, username: "nadia" }]);
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<AssigneePicker onSelect={onSelect} />);

    await user.type(screen.getByRole("combobox"), "nad");
    await user.click(await screen.findByRole("option", { name: "@nadia" }));

    expect(onSelect).toHaveBeenCalledWith({ id: 2, username: "nadia" });
  });

  it("selects the active option with the keyboard", async () => {
    mockFetch([
      { id: 2, username: "nadia" },
      { id: 3, username: "nathan" },
    ]);
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<AssigneePicker onSelect={onSelect} />);

    await user.type(screen.getByRole("combobox"), "na");
    await screen.findByRole("option", { name: "@nadia" });
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}"); // 1st then 2nd option

    expect(onSelect).toHaveBeenCalledWith({ id: 3, username: "nathan" });
  });

  it("does not search on empty input", () => {
    const fetchMock = mockFetch([]);
    render(<AssigneePicker onSelect={() => {}} />);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
