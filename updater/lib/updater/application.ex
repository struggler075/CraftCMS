defmodule Updater.Application do
  use Application

  @port 8081
  @host {127, 0, 0, 1}

  @impl true
  def start(_type, _args) do
    :inets.start(:httpc, [{:profile, :updater}])

    dispatch = :cowboy_router.compile([
      {:_, [
        {"/ws", Updater.WsHandler, []}
      ]}
    ])

    {:ok, _} = :cowboy.start_clear(
      :updater_http,
      [{:port, @port}, {:ip, @host}],
      %{env: %{dispatch: dispatch}}
    )

    Supervisor.start_link([], strategy: :one_for_one, name: Updater.Supervisor)
  end
end
