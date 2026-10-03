-- Catalogue price and weight may describe a purchase package instead of one piece.
UPDATE dndshare.item_type
SET fields = fields || '[{
  "key":"purchase_quantity","name":"Количество в упаковке","type":"int",
  "min":1,"max":2147483647,"default":1,
  "hint":"Цена и вес указаны за это количество. В рюкзаке предметы считаются поштучно."
}]'::jsonb
WHERE id=2 AND NOT EXISTS (
  SELECT 1 FROM jsonb_array_elements(fields) field WHERE field->>'key'='purchase_quantity'
);

ALTER TABLE dndshare.item ADD CONSTRAINT item_purchase_quantity_positive CHECK (
  NOT data ? 'purchase_quantity' OR data->'purchase_quantity'='null'::jsonb OR
  CASE WHEN jsonb_typeof(data->'purchase_quantity')='number'
    THEN (data->>'purchase_quantity')::numeric BETWEEN 1 AND 2147483647
      AND (data->>'purchase_quantity')::numeric=trunc((data->>'purchase_quantity')::numeric)
    ELSE false
  END
);
