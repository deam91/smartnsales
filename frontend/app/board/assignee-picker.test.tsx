import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssigneePicker } from "./board";

type U = { id: number; username: string; name: string };

function mockFetch(results: U[]) {
  const fn = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results }) });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AssigneePicker", () => {
  it("debounces, queries by the typed term, and renders matching names", async () => {
    const fetchMock = mockFetch([{ id: 2, username: "nadia", name: "Nadia Owusu" }]);
    const user = userEvent.setup();
    render(<AssigneePicker onSelect={() => {}} />);

    await user.type(screen.getByRole("combobox"), "nad");
    expect(fetchMock).not.toHaveBeenCalled(); // debounced, not immediate

    expect(await screen.findByRole("option", { name: "Nadia Owusu" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("search=nad");
  });

  it("calls onSelect with the chosen user", async () => {
    mockFetch([{ id: 2, username: "nadia", name: "Nadia Owusu" }]);
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<AssigneePicker onSelect={onSelect} />);

    await user.type(screen.getByRole("combobox"), "nad");
    await user.click(await screen.findByRole("option", { name: "Nadia Owusu" }));

    expect(onSelect).toHaveBeenCalledWith({ id: 2, username: "nadia", name: "Nadia Owusu" });
  });

  it("selects the active option with the keyboard", async () => {
    mockFetch([
      { id: 2, username: "nadia", name: "Nadia Owusu" },
      { id: 3, username: "nathan", name: "Nathan Vega" },
    ]);
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<AssigneePicker onSelect={onSelect} />);

    await user.type(screen.getByRole("combobox"), "na");
    await screen.findByRole("option", { name: "Nadia Owusu" });
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}"); // 1st then 2nd option

    expect(onSelect).toHaveBeenCalledWith({ id: 3, username: "nathan", name: "Nathan Vega" });
  });

  it("does not search on empty input", () => {
    const fetchMock = mockFetch([]);
    render(<AssigneePicker onSelect={() => {}} />);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
