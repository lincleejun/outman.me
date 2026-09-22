<!-- outman:fetch-page:start -->
# Fetching pages
To read a web page, run the `fetch-page` skill's `fetch <url>` CLI and work from the markdown it prints. Never use the WebFetch tool: it returns a small-model rewrite of the page, not the page, and details get lost (a hook blocks it). If `fetch` warns the page is JS-rendered, use the agent-browser skill.
<!-- outman:fetch-page:end -->
