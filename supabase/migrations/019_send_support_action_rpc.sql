-- Atomic wallet transfer for emotional support / Mehfil tickets.
-- Replaces non-atomic client-side balance updates (race / partial failure risk).

CREATE OR REPLACE FUNCTION public.send_support_action(
  p_to_user_id uuid,
  p_action_type text,
  p_amount int,
  p_post_id text DEFAULT NULL,
  p_mehfil_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_my_balance int;
  v_to_balance int;
  v_now timestamptz := now();
  v_sa_id text;
  v_tx_out text;
  v_tx_in text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF v_me = p_to_user_id THEN
    RAISE EXCEPTION 'cannot_support_yourself';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  IF p_action_type IS NULL OR p_action_type NOT IN ('chai', 'rose', 'applaud', 'support', 'ticket') THEN
    RAISE EXCEPTION 'invalid_action_type';
  END IF;

  INSERT INTO wallet_balances (user_id, balance)
  VALUES (v_me, 0)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO wallet_balances (user_id, balance)
  VALUES (p_to_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_my_balance
  FROM wallet_balances
  WHERE user_id = v_me
  FOR UPDATE;

  IF COALESCE(v_my_balance, 0) < p_amount THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  SELECT balance INTO v_to_balance
  FROM wallet_balances
  WHERE user_id = p_to_user_id
  FOR UPDATE;

  UPDATE wallet_balances
  SET balance = COALESCE(v_my_balance, 0) - p_amount
  WHERE user_id = v_me;

  UPDATE wallet_balances
  SET balance = COALESCE(v_to_balance, 0) + p_amount
  WHERE user_id = p_to_user_id;

  v_sa_id := 'sa' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 24);
  v_tx_out := 'tx' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 24);
  v_tx_in := 'txr' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 23);

  INSERT INTO support_actions (
    id, from_user_id, to_user_id, post_id, mehfil_id, action_type, amount, created_at
  ) VALUES (
    v_sa_id, v_me, p_to_user_id, p_post_id, p_mehfil_id, p_action_type, p_amount, v_now
  );

  INSERT INTO transactions (
    id, user_id, kind, amount, status, created_at, counterparty_id, note
  ) VALUES
    (v_tx_out, v_me, 'tip-sent', p_amount, 'completed', v_now, p_to_user_id, p_action_type || ' appreciation'),
    (v_tx_in, p_to_user_id, 'tip-received', p_amount, 'completed', v_now, v_me, p_action_type || ' received');
END;
$$;

REVOKE ALL ON FUNCTION public.send_support_action(uuid, text, int, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_support_action(uuid, text, int, text, text) TO authenticated;

COMMENT ON FUNCTION public.send_support_action IS
  'Atomically debit sender, credit recipient, record support_actions + transactions.';
