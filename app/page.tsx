"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import {
  DEFAULT_GITHUB_SYNC,
  readGithubFile,
  writeGithubFile,
} from "./github-sync";
import {
  parseInventoryQuantity,
  setInventoryQuantity,
  shouldExportBeforeCompleting,
} from "./inventory";

type Product = {
  id: string;
  barcode: string;
  name: string;
  unit: string;
};

type StockLine = {
  productId: string;
  quantity: number;
  updatedAt: string;
};

type Session = {
  id: string;
  startedAt: string;
  updatedAt: string;
  status: "active" | "completed";
  completedAt?: string;
  lines: StockLine[];
};

type InventoryFile = {
  version: 1;
  updatedAt: string;
  products: Product[];
  session: Session | null;
};

const PRODUCTS_KEY = "kiemkho.products.v1";
const SESSION_KEY = "kiemkho.session.v1";
const GITHUB_TOKEN_KEY = "kiemkho.github-token.v1";
const EXPORTED_SESSION_KEY = "kiemkho.exported-session.v1";
const DEFAULT_PRODUCTS: Product[] = [
  { id: "sp-ca-phe-den", barcode: "8938505974011", name: "Cà phê đen", unit: "Gói" },
  { id: "sp-sua-tuoi", barcode: "8934673601001", name: "Sữa tươi không đường", unit: "Hộp" },
  { id: "sp-matcha", barcode: "8936136160018", name: "Bột matcha", unit: "Túi" },
];

const nowId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const formatTime = (iso: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
export default function Home() {
  const [tab, setTab] = useState<"stock" | "products">("stock");
  const [products, setProducts] = useState<Product[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [scannerFor, setScannerFor] = useState<"stock" | "product" | null>(null);
  const [notice, setNotice] = useState("");
  const [confirmNewSession, setConfirmNewSession] = useState(false);
  const [confirmCompleteSession, setConfirmCompleteSession] = useState(false);
  const [confirmClearToken, setConfirmClearToken] = useState(false);
  const [pendingDeleteProduct, setPendingDeleteProduct] = useState<Product | null>(null);
  const [pendingImportProducts, setPendingImportProducts] = useState<Product[] | null>(null);
  const [missingBarcode, setMissingBarcode] = useState("");
  const [exportedSessionId, setExportedSessionId] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [githubToken, setGithubToken] = useState("");
  const [githubTokenDraft, setGithubTokenDraft] = useState("");
  const [syncReady, setSyncReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"loading" | "saved" | "saving" | "error" | "local">("loading");
  const [syncError, setSyncError] = useState("");
  const [syncRevision, setSyncRevision] = useState(0);
  const remoteShaRef = useRef("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [productForm, setProductForm] = useState({ barcode: "", name: "", unit: "Cái" });

  useEffect(() => {
    let cancelled = false;
    const savedProducts = localStorage.getItem(PRODUCTS_KEY);
    const savedSession = localStorage.getItem(SESSION_KEY);
    const localProducts = savedProducts ? JSON.parse(savedProducts) as Product[] : DEFAULT_PRODUCTS;
    const rawLocalSession = savedSession ? JSON.parse(savedSession) as Session : null;
    const localSession = rawLocalSession
      ? {
          ...rawLocalSession,
          updatedAt: rawLocalSession.updatedAt ?? rawLocalSession.startedAt,
          status: rawLocalSession.status ?? "active" as const,
        }
      : null;
    const token = localStorage.getItem(GITHUB_TOKEN_KEY) ?? "";
    setGithubToken(token);
    setGithubTokenDraft(token);
    setExportedSessionId(localStorage.getItem(EXPORTED_SESSION_KEY) ?? "");

    readGithubFile<InventoryFile>(DEFAULT_GITHUB_SYNC, token)
      .then((remote) => {
        if (cancelled) return;
        const remoteSession = remote?.data.session;
        const useRemoteSession = remoteSession &&
          (!localSession || new Date(remoteSession.updatedAt).getTime() > new Date(localSession.updatedAt).getTime());
        setProducts(remote?.data.products?.length ? remote.data.products : localProducts);
        setSession(useRemoteSession ? remoteSession : localSession);
        remoteShaRef.current = remote?.sha ?? "";
        setSyncStatus(remote ? "saved" : token ? "local" : "local");
      })
      .catch((error) => {
        if (cancelled) return;
        setProducts(localProducts);
        setSession(localSession);
        setSyncStatus("error");
        setSyncError(error instanceof Error
          ? error.message
          : "Không tải được file đồng bộ từ GitHub. Hãy kiểm tra kết nối và tải lại trang.");
      })
      .finally(() => {
        if (cancelled) return;
        setHydrated(true);
        setSyncReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  }, [products, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  }, [session, hydrated]);

  useEffect(() => {
    if (!hydrated || !syncReady || !githubToken) return;
    setSyncStatus("saving");
    setSyncError("");
    const timer = window.setTimeout(async () => {
      const payload: InventoryFile = {
        version: 1,
        updatedAt: new Date().toISOString(),
        products,
        session,
      };
      try {
        const sha = await writeGithubFile(DEFAULT_GITHUB_SYNC, githubToken, payload, remoteShaRef.current || undefined);
        remoteShaRef.current = sha;
        setSyncStatus("saved");
      } catch (error) {
        setSyncStatus("error");
        setSyncError(error instanceof Error ? error.message : "Không thể đồng bộ với GitHub.");
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [products, session, githubToken, hydrated, syncReady, syncRevision]);

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const totalQuantity = session?.lines.reduce((sum, line) => sum + line.quantity, 0) ?? 0;

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const startNewSession = () => {
    const now = new Date().toISOString();
    setSession({ id: nowId(), startedAt: now, updatedAt: now, status: "active", lines: [] });
    setSelectedProductId("");
    setQuantity("");
    setConfirmNewSession(false);
    setExportedSessionId("");
    localStorage.removeItem(EXPORTED_SESSION_KEY);
    flash("Đã tạo phiên kiểm kho mới");
  };

  const completeSession = () => {
    if (!session || session.status === "completed") return;
    const now = new Date().toISOString();
    setSession({ ...session, status: "completed", completedAt: now, updatedAt: now });
    setSelectedProductId("");
    setQuantity("");
    setConfirmCompleteSession(false);
    flash("Đã hoàn tất phiên kiểm kho");
  };

  const handleScanned = (barcode: string, target: "stock" | "product") => {
    setScannerFor(null);
    if (target === "product") {
      if (products.some((p) => p.barcode === barcode)) {
        flash("Barcode này đã có trong danh mục");
        return;
      }
      setProductForm((form) => ({ ...form, barcode }));
      flash(`Đã đọc mã ${barcode}`);
      return;
    }

    const product = products.find((p) => p.barcode === barcode);
    if (!product) {
      setMissingBarcode(barcode);
      return;
    }
    setSelectedProductId(product.id);
    setQuantity("");
    flash(`Đã chọn ${product.name}`);
  };

  const saveProduct = () => {
    const barcode = productForm.barcode.trim();
    const name = productForm.name.trim();
    if (!name) return flash("Vui lòng nhập tên sản phẩm");
    if (barcode && products.some((p) => p.barcode === barcode)) {
      return flash("Barcode đã tồn tại, không thể thêm trùng");
    }
    setProducts((current) => [
      ...current,
      { id: nowId(), barcode, name, unit: productForm.unit.trim() || "Cái" },
    ]);
    setProductForm({ barcode: "", name: "", unit: "Cái" });
    flash("Đã thêm sản phẩm");
  };

  const addStock = () => {
    if (!session) return flash("Hãy bắt đầu phiên kiểm kho trước");
    if (!selectedProductId) return flash("Hãy quét hoặc chọn sản phẩm");
    const parsedQuantity = parseInventoryQuantity(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
      return flash("Số lượng không hợp lệ");
    }
    setSession((current) => {
      if (!current || current.status !== "active") return current;
      const updatedAt = new Date().toISOString();
      return {
        ...current,
        updatedAt,
        lines: setInventoryQuantity(current.lines, selectedProductId, parsedQuantity, updatedAt),
      };
    });
    flash("Đã ghi số lượng hiện tại");
    setQuantity("");
  };

  const saveGithubToken = (token: string) => {
    const clean = token.trim().replace(/^Bearer\s+/i, "");
    setGithubToken(clean);
    setGithubTokenDraft(clean);
    remoteShaRef.current = "";
    if (clean) localStorage.setItem(GITHUB_TOKEN_KEY, clean);
    else localStorage.removeItem(GITHUB_TOKEN_KEY);
    setSyncStatus(clean ? "saving" : "local");
    setSyncError("");
    setSyncRevision((revision) => revision + 1);
  };

  const exportExcel = async () => {
    if (!session || session.lines.length === 0) {
      flash("Chưa có dữ liệu để xuất");
      return false;
    }
    setIsExporting(true);
    try {
      const XLSX = await import("xlsx");
      const rows = session.lines.map((line, index) => {
        const product = productById.get(line.productId);
        return {
          STT: index + 1,
          Barcode: product?.barcode ?? "",
          "Tên sản phẩm": product?.name ?? "Không xác định",
          "Đơn vị": product?.unit ?? "",
          "Số lượng": line.quantity,
          "Cập nhật lúc": formatTime(line.updatedAt),
        };
      });
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet(rows);
      sheet["!cols"] = [{ wch: 6 }, { wch: 18 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 22 }];
      XLSX.utils.book_append_sheet(workbook, sheet, "Ton kho");
      XLSX.writeFile(workbook, `kiem-kho-${new Date().toISOString().slice(0, 10)}.xlsx`);
      setExportedSessionId(session.id);
      localStorage.setItem(EXPORTED_SESSION_KEY, session.id);
      flash("Đã xuất file Excel");
      return true;
    } catch {
      flash("Không thể xuất Excel. Vui lòng thử lại.");
      return false;
    } finally {
      setIsExporting(false);
    }
  };

  const confirmAndCompleteSession = async () => {
    if (!session) return;
    setIsCompleting(true);
    if (shouldExportBeforeCompleting(session.id, session.lines.length, exportedSessionId)) {
      const exported = await exportExcel();
      if (!exported) {
        setIsCompleting(false);
        return;
      }
    }
    completeSession();
    setIsCompleting(false);
  };

  const exportProducts = () => {
    const blob = new Blob([JSON.stringify(products, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "products.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const prepareImportProducts = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Product[];
      if (!Array.isArray(parsed) || parsed.some((p) => !p.id || !p.name)) throw new Error();
      const seen = new Set<string>();
      const clean = parsed.filter((p) => !p.barcode || (!seen.has(p.barcode) && seen.add(p.barcode)));
      setPendingImportProducts(clean);
    } catch {
      flash("File danh mục không hợp lệ");
    }
  };

  const openAddMissingProduct = () => {
    setProductForm({ barcode: missingBarcode, name: "", unit: "Cái" });
    setMissingBarcode("");
    setTab("products");
    window.setTimeout(() => document.querySelector<HTMLInputElement>("#product-name")?.focus(), 50);
  };

  if (!hydrated) return <main className="loading">Đang mở sổ kiểm kho…</main>;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">SỔ KHO</p>
          <h1>Kiểm kho nhanh</h1>
        </div>
        <div className={`session-pill ${session?.status === "active" ? "active" : ""}`}>
          <span />
          {session?.status === "active" ? "Đang kiểm kho" : session ? "Đã hoàn tất" : "Chưa có phiên"}
        </div>
      </header>

      <nav className="tabs" aria-label="Chức năng">
        <button className={tab === "stock" ? "selected" : ""} onClick={() => setTab("stock")}>
          Kiểm kho
        </button>
        <button className={tab === "products" ? "selected" : ""} onClick={() => setTab("products")}>
          Sản phẩm
        </button>
      </nav>

      {tab === "stock" ? (
        <div className="content-grid">
          <section className="card session-card">
            <div className="section-heading">
              <div>
                <p className="label">PHIÊN HIỆN TẠI</p>
                <h2>{session ? formatTime(session.startedAt) : "Chưa bắt đầu"}</h2>
              </div>
              {session && <span className="count-badge">{session.lines.length} mặt hàng</span>}
            </div>
            {!session || session.status === "completed" ? (
              <div className="empty-state">
                <div className="empty-icon">✓</div>
                <h3>{session ? "Phiên đã hoàn tất" : "Sẵn sàng kiểm kho?"}</h3>
                <p>{session ? "Kết quả vẫn được giữ và đồng bộ. Bạn có thể tạo phiên tiếp theo." : "Tạo phiên mới để bắt đầu ghi nhận số lượng thực tế."}</p>
                <button className="primary large" onClick={() => setConfirmNewSession(true)}>
                  {session ? "Tạo phiên mới" : "Bắt đầu kiểm kho"}
                </button>
              </div>
            ) : (
              <>
                <div className="action-row">
                  <button className="scan-button" onClick={() => setScannerFor("stock")}>
                    <span className="scan-corners">⌗</span>
                    Quét barcode
                  </button>
                  <span className="or">hoặc</span>
                  <label className="field grow">
                    <span>Chọn sản phẩm</span>
                    <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}>
                      <option value="">Tìm trong danh mục…</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>{product.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="quantity-row">
                  <label className="field grow">
                    <span>Số lượng hiện tại</span>
                    <input type="number" min="0" step="any" inputMode="decimal" placeholder="Ví dụ: 12,5" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                  </label>
                  <button className="primary" onClick={addStock}>Ghi nhận</button>
                </div>
                <div className="session-actions">
                  <button className="secondary" onClick={() => setConfirmCompleteSession(true)}>Hoàn tất phiên</button>
                  <button className="text-button danger-text" onClick={() => setConfirmNewSession(true)}>
                    Tạo phiên mới
                  </button>
                </div>
              </>
            )}
          </section>

          <section className="card inventory-card">
            <div className="section-heading">
              <div>
                <p className="label">KẾT QUẢ</p>
                <h2>Danh sách tồn kho</h2>
              </div>
              <button className={isExporting ? "secondary button-busy" : "secondary"} disabled={isExporting} aria-busy={isExporting} onClick={exportExcel}>
                {isExporting ? "Đang xuất…" : "Xuất Excel"}
              </button>
            </div>
            <div className="summary">
              <div><strong>{session?.lines.length ?? 0}</strong><span>Mặt hàng</span></div>
              <div><strong>{totalQuantity.toLocaleString("vi-VN")}</strong><span>Tổng số lượng</span></div>
            </div>
            {!session?.lines.length ? (
              <p className="table-empty">Sản phẩm đã kiểm sẽ xuất hiện tại đây.</p>
            ) : (
              <div className="stock-list">
                {session.lines.map((line) => {
                  const product = productById.get(line.productId);
                  return (
                    <article key={line.productId}>
                      <div>
                        <h3>{product?.name ?? "Sản phẩm đã xoá"}</h3>
                        <p>{product?.barcode || "Không barcode"} · {product?.unit}</p>
                      </div>
                      <label className="inline-quantity">
                        <input
                          aria-label={`Số lượng ${product?.name}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.quantity}
                          disabled={session.status === "completed"}
                          onChange={(e) => setSession((current) => current ? ({
                            ...current,
                            updatedAt: new Date().toISOString(),
                            lines: current.lines.map((item) => item.productId === line.productId
                              ? { ...item, quantity: parseInventoryQuantity(e.target.value), updatedAt: new Date().toISOString() }
                              : item),
                          }) : current)}
                        />
                        <span>{product?.unit}</span>
                      </label>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="content-grid">
          <section className="card">
            <div className="section-heading">
              <div><p className="label">DANH MỤC</p><h2>Thêm sản phẩm</h2></div>
              <button className="secondary" onClick={() => setScannerFor("product")}>Quét mã</button>
            </div>
            <div className="form-stack">
              <label className="field"><span>Barcode (không bắt buộc)</span><input value={productForm.barcode} onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })} placeholder="Quét hoặc nhập tay" /></label>
              <label className="field"><span>Tên sản phẩm</span><input id="product-name" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="Ví dụ: Sữa đặc Ngôi Sao" /></label>
              <label className="field"><span>Đơn vị tính</span><input value={productForm.unit} onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })} placeholder="Cái, hộp, kg…" /></label>
              <button className="primary large" onClick={saveProduct}>Thêm vào danh mục</button>
            </div>
            <div className="sync-panel">
              <div>
                <p className="label">ĐỒNG BỘ GITHUB</p>
                <h3>{
                  syncStatus === "saved" ? "Đã đồng bộ" :
                  syncStatus === "saving" || syncStatus === "loading" ? "Đang đồng bộ…" :
                  syncStatus === "error" ? "Đồng bộ lỗi" : "Chỉ lưu trên thiết bị"
                }</h3>
                <p>Dữ liệu được lưu tại <code>{DEFAULT_GITHUB_SYNC.path}</code>. Thiết bị mới tự tải file; token chỉ cần khi ghi dữ liệu.</p>
                {syncError && <p className="sync-error" role="alert">{syncError}</p>}
              </div>
              <label className="field">
                <span>GitHub token (Contents: Read and write)</span>
                <input
                  type="password"
                  autoComplete="off"
                  value={githubTokenDraft}
                  onChange={(e) => setGithubTokenDraft(e.target.value)}
                  placeholder="github_pat_…"
                />
              </label>
              <div className="mini-actions">
                <button className="secondary" onClick={() => saveGithubToken(githubTokenDraft)}>Lưu token</button>
                {githubToken && syncStatus === "error" &&
                  <button className="secondary" onClick={() => setSyncRevision((revision) => revision + 1)}>
                    Thử lại
                  </button>}
                {githubToken && <button className="text-button danger-text" onClick={() => setConfirmClearToken(true)}>Xoá token</button>}
              </div>
            </div>
          </section>
          <section className="card">
            <div className="section-heading">
              <div><p className="label">{products.length} SẢN PHẨM</p><h2>Danh mục hiện có</h2></div>
              <div className="mini-actions">
                <label className="secondary file-button">Nhập JSON<input type="file" accept=".json,application/json" onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) prepareImportProducts(file);
                }} /></label>
                <button className="secondary" onClick={exportProducts}>Xuất JSON</button>
              </div>
            </div>
            <div className="product-list">
              {products.map((product) => (
                <article key={product.id}>
                  <div><h3>{product.name}</h3><p>{product.barcode || "Không barcode"} · {product.unit}</p></div>
                  <button className="delete-button" aria-label={`Xoá ${product.name}`} onClick={() => setPendingDeleteProduct(product)}>×</button>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {scannerFor && <BarcodeScanner target={scannerFor} onScan={handleScanned} onClose={() => setScannerFor(null)} />}

      {confirmNewSession && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <div className="warning-icon">!</div>
            <h2 id="confirm-title">Tạo phiên kiểm kho mới?</h2>
            <p>Kết quả phiên hiện tại sẽ được thay bằng phiên mới trong file đồng bộ. Hãy xuất Excel trước nếu bạn cần lưu riêng kết quả cũ.</p>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setConfirmNewSession(false)}>Huỷ</button>
              <button className="danger" onClick={startNewSession}>Tạo phiên mới</button>
            </div>
          </div>
        </div>
      )}

      {confirmCompleteSession && session && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="complete-title">
            <div className="empty-icon modal-icon">✓</div>
            <h2 id="complete-title">Hoàn tất phiên kiểm kho?</h2>
            <p>
              {!shouldExportBeforeCompleting(session.id, session.lines.length, exportedSessionId)
                && session.lines.length > 0
                ? "Phiên này đã được xuất Excel thủ công. Sau khi hoàn tất, số lượng sẽ chỉ được xem và không thể chỉnh sửa."
                : session.lines.length > 0
                  ? "Hệ thống sẽ tự động tải file Excel trước khi khoá phiên kiểm kho."
                  : "Phiên chưa có sản phẩm nên sẽ không tạo file Excel."}
            </p>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setConfirmCompleteSession(false)}>Huỷ</button>
              <button className={isCompleting ? "primary button-busy" : "primary"} disabled={isCompleting} aria-busy={isCompleting} onClick={confirmAndCompleteSession}>
                {isCompleting ? "Đang hoàn tất…" : "Xác nhận hoàn tất"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteProduct && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-product-title">
            <div className="warning-icon">!</div>
            <h2 id="delete-product-title">Xoá sản phẩm?</h2>
            <p>
              Sản phẩm <strong>{pendingDeleteProduct.name}</strong> sẽ bị xoá khỏi danh mục
              {session?.lines.some((line) => line.productId === pendingDeleteProduct.id)
                ? " và đang có trong kết quả phiên hiện tại."
                : "."}
            </p>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setPendingDeleteProduct(null)}>Huỷ</button>
              <button className="danger" onClick={() => {
                setProducts((items) => items.filter((item) => item.id !== pendingDeleteProduct.id));
                setPendingDeleteProduct(null);
                flash("Đã xoá sản phẩm");
              }}>Xác nhận xoá</button>
            </div>
          </div>
        </div>
      )}

      {pendingImportProducts && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="import-products-title">
            <div className="warning-icon">!</div>
            <h2 id="import-products-title">Thay toàn bộ danh mục?</h2>
            <p>Danh mục hiện tại gồm {products.length} sản phẩm sẽ được thay bằng {pendingImportProducts.length} sản phẩm từ file JSON.</p>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setPendingImportProducts(null)}>Huỷ</button>
              <button className="danger" onClick={() => {
                setProducts(pendingImportProducts);
                flash(`Đã nhập ${pendingImportProducts.length} sản phẩm`);
                setPendingImportProducts(null);
              }}>Xác nhận thay thế</button>
            </div>
          </div>
        </div>
      )}

      {confirmClearToken && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="clear-token-title">
            <div className="warning-icon">!</div>
            <h2 id="clear-token-title">Xoá GitHub token?</h2>
            <p>Thiết bị này sẽ ngừng ghi dữ liệu lên GitHub cho đến khi bạn nhập token mới. Dữ liệu local vẫn được giữ nguyên.</p>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setConfirmClearToken(false)}>Huỷ</button>
              <button className="danger" onClick={() => {
                setGithubTokenDraft("");
                saveGithubToken("");
                setConfirmClearToken(false);
                flash("Đã xoá GitHub token");
              }}>Xác nhận xoá</button>
            </div>
          </div>
        </div>
      )}

      {missingBarcode && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="missing-product-title">
            <div className="warning-icon">!</div>
            <h2 id="missing-product-title">Sản phẩm chưa có trong danh mục</h2>
            <p>Barcode <strong>{missingBarcode}</strong> chưa thể kiểm đếm. Hãy nhập thông tin sản phẩm trước rồi quét lại.</p>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setMissingBarcode("")}>Để sau</button>
              <button className="primary" onClick={openAddMissingProduct}>Nhập sản phẩm</button>
            </div>
          </div>
        </div>
      )}

      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}

function BarcodeScanner({
  target,
  onScan,
  onClose,
}: {
  target: "stock" | "product";
  onScan: (barcode: string, target: "stock" | "product") => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const reader = new BrowserMultiFormatReader();
    reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } }, audio: false },
        videoRef.current!,
        (result) => {
          if (result && alive) {
            alive = false;
            controlsRef.current?.stop();
            onScan(result.getText(), target);
          }
        },
      )
      .then((controls) => {
        controlsRef.current = controls;
      })
      .catch(() => setError("Không mở được camera. Hãy cấp quyền camera hoặc nhập mã bằng tay."));
    return () => {
      alive = false;
      controlsRef.current?.stop();
    };
  }, [onScan, target]);

  return (
    <div className="scanner">
      <div className="scanner-top">
        <button onClick={onClose}>Đóng</button>
        <strong>Đưa barcode vào khung</strong>
        <span />
      </div>
      <div className="camera-frame">
        <video ref={videoRef} muted playsInline />
        <div className="scan-guide"><span /></div>
      </div>
      <p>{error || "Giữ điện thoại ổn định, mã sẽ được nhận tự động."}</p>
    </div>
  );
}
