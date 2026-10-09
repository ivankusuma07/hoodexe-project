CREATE TABLE "callouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet" text NOT NULL,
	"token_address" text,
	"ticker" text,
	"text" text NOT NULL,
	"kind" text NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"hidden_reason" text,
	"source_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "callouts_source_key_unique" UNIQUE("source_key")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"wallet" text PRIMARY KEY NOT NULL,
	"nickname" text,
	"nickname_changed_at" timestamp with time zone,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_nickname_unique" UNIQUE("nickname")
);
--> statement-breakpoint
CREATE TABLE "reactions" (
	"callout_id" uuid NOT NULL,
	"wallet" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reactions_callout_id_wallet_kind_pk" PRIMARY KEY("callout_id","wallet","kind")
);
--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_callout_id_callouts_id_fk" FOREIGN KEY ("callout_id") REFERENCES "public"."callouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "callouts_created_idx" ON "callouts" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "callouts_token_idx" ON "callouts" USING btree ("token_address","created_at");--> statement-breakpoint
CREATE INDEX "callouts_wallet_idx" ON "callouts" USING btree ("wallet");