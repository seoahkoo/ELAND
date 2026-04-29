-- ============================================================
--  ELAND 의류CU 주간 실적 대시보드  –  Supabase Schema v2
--  SAP BI 올해 RAW 시트 기준으로 재설계
--
--  적용 전 기존 테이블 제거:
--    DROP TABLE IF EXISTS sales_weekly CASCADE;
--    DROP TABLE IF EXISTS products CASCADE;
--    DROP TABLE IF EXISTS upload_logs CASCADE;
-- ============================================================

-- ──────────────────────────────────────────────
--  업로드 로그
-- ──────────────────────────────────────────────
CREATE TABLE upload_logs (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  filename    TEXT        DEFAULT '',
  week_label  TEXT        NOT NULL,   -- e.g. "2026-W09 (02-23~03-01)"
  week_start  DATE,
  week_end    DATE,
  row_count   INTEGER     DEFAULT 0
);

-- ──────────────────────────────────────────────
--  스타일별 주간 실적  (SAP BI 올해 RAW 기반)
-- ──────────────────────────────────────────────
CREATE TABLE sales_weekly (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_id  UUID REFERENCES upload_logs(id) ON DELETE CASCADE,
  week_label TEXT NOT NULL,

  -- 스타일 식별 정보
  style_code     TEXT    NOT NULL,
  product_name   TEXT    DEFAULT '',
  season         TEXT    DEFAULT '',
  cd             TEXT    DEFAULT '',   -- CD 구분 (라이프스타일 / 아동캐주얼 등)
  cell_type      TEXT    DEFAULT '',   -- 셀 구분 (베이직셀 등)
  brand          TEXT    DEFAULT '미분류',
  month          INTEGER DEFAULT 0,
  category_l     TEXT    DEFAULT '',   -- 대분류
  category_m     TEXT    DEFAULT '',   -- 중분류
  category_s     TEXT    DEFAULT '',   -- 소분류
  original_price NUMERIC DEFAULT 0,   -- 최초판매가(특가기준)
  current_price  NUMERIC DEFAULT 0,   -- 현재판매가(특가기준)

  -- 기간 데이터 (해당 업로드 주차)
  period_sale_qty    NUMERIC DEFAULT 0,   -- 기간 판매량
  period_sale_amt    NUMERIC DEFAULT 0,   -- 기간 총매출액
  period_receipt_amt NUMERIC DEFAULT 0,   -- 기간 입고액(최초판매가)
  period_cost_amt    NUMERIC DEFAULT 0,   -- 기간 총매출원가
  period_margin_rate NUMERIC DEFAULT 0,   -- 기간 매출총이익율(%)

  -- 누적 데이터 (시즌 YTD)
  cum_sale_qty     NUMERIC DEFAULT 0,   -- 누적 판매량
  cum_sale_amt     NUMERIC DEFAULT 0,   -- 누적 총매출액
  cum_receipt_amt  NUMERIC DEFAULT 0,   -- 누적 입고액(최초판매가)
  cum_cost_amt     NUMERIC DEFAULT 0,   -- 누적 총매출원가
  cum_margin_rate  NUMERIC DEFAULT 0,   -- 누적 매출총이익율(%)
  cum_sale_rate    NUMERIC DEFAULT 0,   -- 누적 판매율(%)
  cum_jungpan_rate NUMERIC DEFAULT 0,   -- 누적 입고대비 정판율(%)

  UNIQUE (week_label, style_code)
);

-- ──────────────────────────────────────────────
--  인덱스
-- ──────────────────────────────────────────────
CREATE INDEX idx_sw_week_label ON sales_weekly (week_label);
CREATE INDEX idx_sw_brand      ON sales_weekly (brand);
CREATE INDEX idx_sw_style_code ON sales_weekly (style_code);
CREATE INDEX idx_sw_category_l ON sales_weekly (category_l);

-- ──────────────────────────────────────────────
--  RLS (Row Level Security)
-- ──────────────────────────────────────────────
ALTER TABLE upload_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_weekly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_upload_logs"  ON upload_logs  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_sales_weekly" ON sales_weekly FOR ALL USING (true) WITH CHECK (true);

-- ──────────────────────────────────────────────
--  뷰: 브랜드별 집계
-- ──────────────────────────────────────────────
CREATE OR REPLACE VIEW v_brand_summary AS
SELECT
  week_label,
  brand,
  SUM(period_sale_qty)    AS period_sale_qty,
  SUM(period_sale_amt)    AS period_sale_amt,
  SUM(period_receipt_amt) AS period_receipt_amt,
  SUM(cum_sale_qty)       AS cum_sale_qty,
  SUM(cum_sale_amt)       AS cum_sale_amt,
  SUM(cum_receipt_amt)    AS cum_receipt_amt,
  SUM(cum_cost_amt)       AS cum_cost_amt,
  SUM(cum_sale_amt) - SUM(cum_cost_amt) AS margin_amt,
  CASE WHEN SUM(cum_sale_amt) > 0
       THEN ROUND((SUM(cum_sale_amt) - SUM(cum_cost_amt))
                  / SUM(cum_sale_amt) * 100, 2)
       ELSE 0 END AS margin_rate
FROM sales_weekly
GROUP BY week_label, brand;
