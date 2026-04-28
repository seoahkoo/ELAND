-- =============================================
-- ELAND Dashboard - Supabase Schema
-- =============================================

-- 1. 업로드 이력
CREATE TABLE upload_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename    text NOT NULL,
  week_label  text,                        -- 예: "2026-W15"
  row_count   integer,
  status      text DEFAULT 'success',      -- success | error
  uploaded_at timestamptz DEFAULT now()
);

-- 2. 상품 마스터 (26기연상품 / 25기연상품 시트)
CREATE TABLE products (
  product_code  text PRIMARY KEY,          -- 상품코드
  style_name    text,                      -- 스타일명
  brand         text,
  season        text,                      -- SS / FW / A
  color_cd      text,                      -- CD
  category_l    text,                      -- 대분류
  category_m    text,                      -- 중분류
  category_s    text,                      -- 소분류
  sale_price    numeric,                   -- 판매가(특가기준)
  cost_price    numeric,                   -- 원가
  updated_at    timestamptz DEFAULT now()
);

-- 3. 주간 판매 원시 데이터 (누적 시트 기준)
CREATE TABLE sales_weekly (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id             uuid REFERENCES upload_logs(id) ON DELETE CASCADE,
  week_label            text NOT NULL,             -- "2026-W15"
  week_start            date,                      -- 주 시작일
  week_end              date,                      -- 주 종료일

  -- 식별자
  product_code          text NOT NULL,
  brand                 text,
  season                text,
  color_cd              text,
  category_l            text,
  category_m            text,
  category_s            text,
  style_name            text,

  -- 기획/입고
  planned_qty           numeric DEFAULT 0,         -- 기획수량
  planned_receipt_amt   numeric DEFAULT 0,         -- 기획입고금액(특가기준)

  -- 기간(해당 주) 실적
  period_sale_qty       numeric DEFAULT 0,         -- 기간 판매량
  period_sale_amt       numeric DEFAULT 0,         -- 기간 판매금액(특가기준)
  period_discount_rate  numeric DEFAULT 0,         -- 기간 할인율
  period_sale_rate      numeric DEFAULT 0,         -- 기간 판매율

  -- 누적 실적
  cum_sale_qty          numeric DEFAULT 0,         -- 누적 판매량
  cum_sale_amt          numeric DEFAULT 0,         -- 누적 판매금액(특가기준)
  cum_sale_rate         numeric DEFAULT 0,         -- 누적 판매율

  -- 원가
  cost_total_cum        numeric DEFAULT 0,         -- 원가합계(누적수량기준)

  -- 잔여
  remain_qty            numeric DEFAULT 0,         -- 잔여 판매량
  remain_amt            numeric DEFAULT 0,         -- 잔여 판매금액

  created_at            timestamptz DEFAULT now(),

  UNIQUE (week_label, product_code)               -- 주+상품코드 중복 방지
);

-- 4. 인덱스
CREATE INDEX idx_sales_week        ON sales_weekly (week_label);
CREATE INDEX idx_sales_brand       ON sales_weekly (brand);
CREATE INDEX idx_sales_product     ON sales_weekly (product_code);
CREATE INDEX idx_sales_category_l  ON sales_weekly (category_l);
CREATE INDEX idx_sales_week_start  ON sales_weekly (week_start);

-- =============================================
-- Views (집계)
-- =============================================

-- 브랜드별 주간 집계
CREATE OR REPLACE VIEW v_brand_weekly AS
SELECT
  week_label,
  week_start,
  brand,
  SUM(planned_receipt_amt)  AS planned_receipt_amt,
  SUM(period_sale_qty)      AS period_sale_qty,
  SUM(period_sale_amt)      AS period_sale_amt,
  SUM(cum_sale_qty)         AS cum_sale_qty,
  SUM(cum_sale_amt)         AS cum_sale_amt,
  SUM(cost_total_cum)       AS cost_total_cum,
  -- 마진금액 = 누적판매금액 - 원가합계
  SUM(cum_sale_amt) - SUM(cost_total_cum) AS margin_amt,
  -- 마진율
  CASE WHEN SUM(cum_sale_amt) > 0
    THEN ROUND((SUM(cum_sale_amt) - SUM(cost_total_cum)) / SUM(cum_sale_amt) * 100, 2)
    ELSE 0
  END AS margin_rate
FROM sales_weekly
GROUP BY week_label, week_start, brand;

-- 상품별 누적 집계
CREATE OR REPLACE VIEW v_product_summary AS
SELECT
  product_code,
  style_name,
  brand,
  category_l,
  category_m,
  SUM(planned_receipt_amt)  AS planned_receipt_amt,
  SUM(cum_sale_qty)         AS cum_sale_qty,
  SUM(cum_sale_amt)         AS cum_sale_amt,
  SUM(cost_total_cum)       AS cost_total_cum,
  SUM(cum_sale_amt) - SUM(cost_total_cum) AS margin_amt,
  CASE WHEN SUM(cum_sale_amt) > 0
    THEN ROUND((SUM(cum_sale_amt) - SUM(cost_total_cum)) / SUM(cum_sale_amt) * 100, 2)
    ELSE 0
  END AS margin_rate,
  -- 판매효율 = 입고비중 - 판매비중 (전체 대비)
  ROUND(
    SUM(planned_receipt_amt)::numeric / NULLIF((SELECT SUM(planned_receipt_amt) FROM sales_weekly), 0) * 100 -
    SUM(cum_sale_amt)::numeric         / NULLIF((SELECT SUM(cum_sale_amt) FROM sales_weekly), 0) * 100,
    4
  ) AS sales_efficiency
FROM sales_weekly
GROUP BY product_code, style_name, brand, category_l, category_m;
