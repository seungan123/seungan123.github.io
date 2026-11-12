# frozen_string_literal: true

module Journal
  class TopicPages < Jekyll::Generator
    priority :lowest

    def generate(site)
      posts = site.posts.docs.sort.reverse.reject { |post| post.data["hidden"] }
      pinned, ordinary = posts.partition { |post| post.data["pin"] }
      posts = pinned + ordinary
      site.data["journal_total"] = posts.size
      page_size = site.config.fetch("paginate", 10)

      site.data.fetch("journal_topics").each do |topic|
        entries = posts.select do |post|
          Array(post.data["categories"]).any? { |name| name.to_s.casecmp?(topic.fetch("name")) }
        end
        topic["count"] = entries.size
        base = "topics/#{topic.fetch('slug')}"
        topic["url"] = "/#{base}/"
        pages = entries.each_slice(page_size).to_a
        pages = [[]] if pages.empty?

        pages.each_with_index do |group, index|
          directory = index.zero? ? base : "#{base}/page#{index + 1}"
          page = Jekyll::PageWithoutAFile.new(site, site.source, directory, "index.html")
          page.data.merge!(
            "layout" => "journal-topic",
            "title" => topic.fetch("name"),
            "journal_topic" => topic,
            "journal_posts" => group,
            "journal_offset" => index * page_size
          )
          page.data["journal_previous"] = index == 1 ? "/#{base}/" : "/#{base}/page#{index}/" if index.positive?
          page.data["journal_next"] = "/#{base}/page#{index + 2}/" if index + 1 < pages.size
          site.pages << page
        end
      end
    end
  end
end
