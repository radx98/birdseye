## General Instructions

- Use bun
- Don't switch between branches

### Data source

Data is fetched from Modal. MODAL_TOKEN_ID and MODAL_TOKEN_SECRET are in the ".env" file. The fetch algorythm is already implemented for several elements on the page, which can be used as an example.

Data sample can be found in "data_sample" folder. Don't ever use it in the code, it's gonna be deleted later. It is there just to show the structure of the Modal volume that the data should be fetched from. There is also a detailed map of the data in the Modal volume in spec_data_map.md. The volume's name is 'twitter-archive-data' and it contains the saeme two user folders, 'exgenesis' and 'romeostevens76' in its root. Later there are going to be more users. If any data is missing the page should show a corresponding message.

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

Infobox "⚡ Clusters are automatically sorted by recency. Some (especially the largest ones) may be too broad or noisy"

"Hide low quality clusters" switch on the right above the table with "i" icon next to it showing popup "Filter out clusters marked as low quality by the AI"

Scrollable table of clusters with the following columns. It's height is 75% of it's width.
- Name
- Number of Tweets [number]
- Median Likes [number]
- Total Likes [number]
- Median Date [date]
- Tweets per Month [chart]

Three blocks in a row that show information on the cluster selected in the table.
1. Selected Cluster (takes 50% of horizontal space)
    - Number of Tweets
    - Total Likes
    - Median Date
    - Summary "..."
2. Most replied to: list of users with number of replies in brackets (takes 25% of horizontal space)
3. Related Clusters: list of related clusters (takes 25% of horizontal space)

### Yearly summaries

- Year selector (tabs)
- Summary of the selected year

### Tweets over time

Infobox "📈 Drag horizontally on the graph to filter tweets in the right column."

Chart

### Ontology

Infobox: "↔️ We gathered some key features to help understand the topic all at once. You can click 🔗 references to see the tweets that inform them."

Three blocks in a row in two rows, each includes up to 4 items that consist of a short paragraph and "🔗 [number] references". Blocks are styled the same way as Most replied to and Related Clusters.
- Entities
- Beliefs & Values
- Goals
- Social Relationships
- Moods & Emotional Tones
- Key Concepts

### Threads and Tweets

Switches "Hide Replies", "Hide Retweets", "Hide incomplete threads" with "i" icon popping up "Some conversation threads may be incomplete because not all tweets were captured in the archive"

Sorting dropdown with "Favorite Count", "Date", "Cluster Probability" options + "Ascending order" switch

Infobox: "↔️ Scroll to see more tweet threads. Only the longest thread starting at each root is displayed."

List of threads and tweets in a waterfall/masonry layout 3 in a row. Each in its own block styled the same way as Most replied to and Related Clusters but without headers. Inside is a traditional tweet layout with user pic on the left and username, date, text, likes number on the right. Then if it's a thread, next tweet after a separator.