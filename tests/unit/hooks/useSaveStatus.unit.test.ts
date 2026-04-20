import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useSaveStatus } from "@/hooks/useSaveStatus"
import { MOCK_DIAGRAM, EMPTY_DIAGRAM } from "@/lib/excalidraw"

const mockFetch = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal("fetch", mockFetch)
  mockFetch.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("useSaveStatus", () => {
  it("starts with idle status", () => {
    const { result } = renderHook(() =>
      useSaveStatus({ diagramId: "test-id" })
    )
    expect(result.current.status).toBe("idle")
  })

  it("sets status to pending immediately when schedulesSave is called", () => {
    const { result } = renderHook(() =>
      useSaveStatus({ diagramId: "test-id" })
    )
    act(() => {
      result.current.schedulesSave(MOCK_DIAGRAM)
    })
    expect(result.current.status).toBe("pending")
  })

  it("debounces — only one fetch for multiple schedulesSave calls", async () => {
    mockFetch.mockResolvedValue({ ok: true })
    const { result } = renderHook(() =>
      useSaveStatus({ diagramId: "test-id", debounceMs: 500 })
    )
    act(() => {
      result.current.schedulesSave(MOCK_DIAGRAM)
      result.current.schedulesSave(EMPTY_DIAGRAM)
      result.current.schedulesSave(MOCK_DIAGRAM)
    })
    await act(async () => {
      vi.advanceTimersByTime(500)
      await vi.runAllTimersAsync()
    })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("transitions to saving after debounce fires", async () => {
    mockFetch.mockReturnValue(new Promise(() => {})) // never resolves
    const { result } = renderHook(() =>
      useSaveStatus({ diagramId: "test-id", debounceMs: 500 })
    )
    act(() => {
      result.current.schedulesSave(MOCK_DIAGRAM)
    })
    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current.status).toBe("saving")
  })

  it("transitions to saved then idle on successful fetch", async () => {
    mockFetch.mockResolvedValue({ ok: true })
    const { result } = renderHook(() =>
      useSaveStatus({ diagramId: "test-id", debounceMs: 100 })
    )
    act(() => {
      result.current.schedulesSave(MOCK_DIAGRAM)
    })
    await act(async () => {
      vi.advanceTimersByTime(100)
      await Promise.resolve()
    })
    expect(result.current.status).toBe("saved")

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.status).toBe("idle")
  })

  it("transitions to error on fetch failure", async () => {
    mockFetch.mockRejectedValue(new Error("network error"))
    const { result } = renderHook(() =>
      useSaveStatus({ diagramId: "test-id", debounceMs: 100 })
    )
    act(() => {
      result.current.schedulesSave(MOCK_DIAGRAM)
    })
    await act(async () => {
      vi.advanceTimersByTime(100)
      await Promise.resolve()
    })
    expect(result.current.status).toBe("error")
  })

  it("retry triggers immediate save without debounce", async () => {
    mockFetch
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce({ ok: true })
    const { result } = renderHook(() =>
      useSaveStatus({ diagramId: "test-id", debounceMs: 100 })
    )
    act(() => {
      result.current.schedulesSave(MOCK_DIAGRAM)
    })
    await act(async () => {
      vi.advanceTimersByTime(100)
      await Promise.resolve()
    })
    expect(result.current.status).toBe("error")

    await act(async () => {
      result.current.retry()
      await Promise.resolve()
    })
    expect(result.current.status).toBe("saved")
  })

  it("unmount with pending state fires an immediate keepalive fetch", () => {
    mockFetch.mockResolvedValue({ ok: true })
    const { result, unmount } = renderHook(() =>
      useSaveStatus({ diagramId: "test-id", debounceMs: 500 })
    )
    act(() => {
      result.current.schedulesSave(MOCK_DIAGRAM)
    })
    unmount()
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/diagrams/test-id",
      expect.objectContaining({ method: "PUT", keepalive: true })
    )
  })

  it("unmount without pending state does not fire fetch", () => {
    const { unmount } = renderHook(() =>
      useSaveStatus({ diagramId: "test-id" })
    )
    unmount()
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
