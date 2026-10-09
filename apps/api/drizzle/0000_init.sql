CREATE TABLE "launches" (
	"tx_hash" text PRIMARY KEY NOT NULL,
	"token_address" text NOT NULL,
	"curve_address" text NOT NULL,
	"creator" text NOT NULL,
	"pair_token" text NOT NULL,
	"metadata_cid" text,
	"rigor_score" integer,
	"block_number" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "launches_token_address_unique" UNIQUE("token_address")
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"content_hash" text PRIMARY KEY NOT NULL,
	"statement" text NOT NULL,
	"score" integer NOT NULL,
	"parts" jsonb NOT NULL,
	"status_label" text NOT NULL,
	"reasoning" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"wallet" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "launches_creator_idx" ON "launches" USING btree ("creator");--> statement-breakpoint
CREATE INDEX "sessions_wallet_idx" ON "sessions" USING btree ("wallet");