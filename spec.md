## General Instructions

- Use bun
- Don't switch between branches

## Layout

### "{/public/favicon.svg} Birdseye"

"Birdseye helps you explore patterns in your tweet history by automatically clustering your tweets into topics. It's powered by the [Community Archive](https://www.community-archive.org/).

Key features:
- 📊 Topics are sorted by date (newest first)
- 🔍 Each cluster shows stats, summaries, and yearly evolution
- 📈 Timeline charts help track topic engagement over time
- 🧵 View full threads and conversations within each topic

Note: While most clusters are meaningful, some (especially the largest ones) may be too broad or noisy. The tool works best for exploration - try sorting by median date or likes to find interesting patterns!"

### Select a User

Choose a user to explore
- [dropdown menu with {@user} options to choose]
- ["Explore" button (when visitor chooses a user and presses "Explore", the rest of the content loads below)]

### User info

- On the left: round user avatar
- On the right:
    - @user
    - user description
    - 📊 [number] clusters
    
- [number] "Tweets"
- [number] "Following"
- [number] "Followers"
- [number] "Likes"

### Clusters

"Hide low quality clusters" switch with "i" icon next to it showing popup "Filter out clusters marked as low quality by the AI"

Infobox "⚡ Clusters are automatically sorted by recency. Some (especially the largest ones) may be too broad or noisy"

Table of clusters. Columns:
- Name
- Number of Tweets
- Median Likes
- Total Likes
- Median Date
- Tweets per Month

Selected cluster info
- Number of Tweets
- Total Likes
- Median Date
- Summary "..."

Most replied to: list of users with number of replies in brackets

Related Clusters: list of related clusters

### Yearly summaries

- Year selector
- Year summary

### Tweets over time

Infobox "📈 Drag horizontally on the graph to filter tweets in the right column."

Chart

### Ontology

Infobox: "↔️ We gathered some key features to help understand the topic all at once. You can click 🔗 references to see the tweets that inform them."

Horizontally scrollable columns, each includes up to 4 items that consist of a short paragraph and "🔗 [number] references"
- Entities
- Beliefs & Values
- Goals
- Social Relationships
- Moods & Emotional Tones
- Key Concepts

### Threads and Tweets

Switches "Hide Replies", "Hide Retweets", "Hide incomplete threads" with "i" icon poping up "Some conversation threads may be incomplete because not all tweets were captured in the archive"

Sort dropdown with "Favorite Count", "Date", "Cluster Probability" options + "Ascending order" switch

Infobox: "↔️ Scroll to see more tweet threads. Only the longest thread starting at each root is displayed."

List of threads and tweets in a waterfall/masonry layout