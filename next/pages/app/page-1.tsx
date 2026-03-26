/**
 * page-1 – App demo
 * Slug: "page-1"
 * Mỗi file trong pages/app/ là một app riêng, có giao diện và backend riêng.
 */
export default function Page1() {
  return (
    <div style={{ padding: "2rem", fontFamily: "Inter, sans-serif" }}>
      <h1>Page 1</h1>
      <p>Đây là app demo. Mỗi page trong thư mục pages/app/ là một app độc lập.</p>
    </div>
  );
}
