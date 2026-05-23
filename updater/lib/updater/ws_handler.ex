defmodule Updater.WsHandler do
  @behaviour :cowboy_websocket

  require Logger

  @java_base "http://127.0.0.1:8080"
  @update_script "/opt/craftcms/update.sh"
  # Matches ANSI escape sequences (colors, cursor movement, etc.)
  @ansi_re ~r/\x1b\[[0-9;]*[mGKHFABCDJnhlu]|\x1b\[?\d*[A-Za-z]/

  # ── Cowboy lifecycle ──────────────────────────────────────────────────────────

  def init(req, _opts) do
    {:cowboy_websocket, req, %{}, %{idle_timeout: 600_000}}
  end

  def websocket_init(state), do: {:ok, state}

  # ── Frames from the browser ───────────────────────────────────────────────────

  def websocket_handle({:text, msg}, state) do
    case Jason.decode(msg) do
      {:ok, %{"type" => "start", "token" => token}} ->
        case validate_token(token) do
          {:ok, github_token} ->
            send(self(), {:run_update, github_token})
            {:ok, state}

          {:error, reason} ->
            reply = Jason.encode!(%{type: "error", message: reason})
            {:reply, {:text, reply}, state}
        end

      _ ->
        {:ok, state}
    end
  end

  def websocket_handle(_frame, state), do: {:ok, state}

  # ── Process messages ──────────────────────────────────────────────────────────

  def websocket_info({:run_update, github_token}, state) do
    env = [
      {'GITHUB_TOKEN_ENV', String.to_charlist(github_token)},
      {'HOME', '/root'},
      {'TERM', 'dumb'},
      {'PATH', '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/opt/maven/bin'}
    ]

    port = Port.open(
      {:spawn_executable, "/bin/bash"},
      [:binary, :exit_status, {:line, 8192}, {:env, env},
       {:args, ["-c", "bash #{@update_script} --verbose 2>&1"]}]
    )

    {:ok, Map.put(state, :port, port)}
  end

  # Complete line (terminated by newline)
  def websocket_info({port, {:data, {:eol, line}}}, %{port: port} = state) do
    push_line(line, state)
  end

  # Partial chunk (buffer hit line limit before newline)
  def websocket_info({port, {:data, {:noeol, chunk}}}, %{port: port} = state) do
    push_line(chunk, state)
  end

  # Script finished
  def websocket_info({port, {:exit_status, code}}, %{port: port} = state) do
    payload = Jason.encode!(%{type: "exit", code: code})
    {:reply, {:text, payload}, Map.delete(state, :port)}
  end

  def websocket_info(_msg, state), do: {:ok, state}

  # ── Cleanup ───────────────────────────────────────────────────────────────────

  def terminate(_reason, _req, state) do
    case Map.get(state, :port) do
      nil  -> :ok
      port ->
        try do Port.close(port) rescue _ -> :ok end
    end
    :ok
  end

  # ── Helpers ───────────────────────────────────────────────────────────────────

  defp push_line(raw, state) do
    clean   = Regex.replace(@ansi_re, raw, "")
    payload = Jason.encode!(%{type: "log", line: clean})
    {:reply, {:text, payload}, state}
  end

  defp validate_token(token) do
    url = String.to_charlist(
      "#{@java_base}/api/internal/ws-token-valid?t=#{URI.encode_www_form(token)}"
    )

    case :httpc.request(:get, {url, []}, [{:timeout, 5000}], [], :updater) do
      {:ok, {{_, 200, _}, _headers, body}} ->
        case Jason.decode(IO.iodata_to_binary(body)) do
          {:ok, %{"githubToken" => gh}} -> {:ok, gh}
          _                             -> {:error, "unexpected auth response"}
        end

      {:ok, {{_, status, _}, _, _}} ->
        {:error, "auth rejected (HTTP #{status})"}

      {:error, reason} ->
        Logger.warning("Token validation failed: #{inspect(reason)}")
        {:error, "cannot reach auth service"}
    end
  end
end
