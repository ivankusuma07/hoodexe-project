CREATE TABLE "index_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"token_address" text PRIMARY KEY NOT NULL,
	"curve_address" text NOT NULL,
	"deployer" text NOT NULL,
	"pair_token" text NOT NULL,
	"block_number" bigint NOT NULL,
	"launched_at" timestamp with time zone NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"logo" text NOT NULL,
	"description" text NOT NULL,
	"hood" boolean DEFAULT false NOT NULL,
	"statement" text,
	"metadata_cid" text,
	"rigor_score" integer,
	"graduation_threshold" numeric(78, 0) NOT NULL,
	"phase" smallint DEFAULT 0 NOT NULL,
	"quote_reserve" numeric(78, 0),
	"token_reserve" numeric(78, 0),
	"real_quote_reserve" numeric(78, 0),
	"state_updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "tokens_block_idx" ON "tokens" USING btree ("block_number");--> statement-breakpoint
CREATE INDEX "tokens_hood_idx" ON "tokens" USING btree ("hood","block_number");