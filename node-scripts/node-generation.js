const omit = require('lodash/omit');
const fs = require('fs');

/**
 * Transform camel case str to dash case
 * @param {string} str - Camel case string
 */
function camelCaseToDash(str) {
  return str.replace(/([a-zA-Z])(?=[A-Z])/g, '$1-').toLowerCase();
}

/**
 * Returns filtered object that omits Gatsby node properties
 * @param {object} node - Node object
 */
const getJson = (node) => {
  return omit(node, ['id', 'children', 'parent', 'internal']);
};

/**
 * String timestamp parser to amount of seconds
 * @param {string} timeString - Timestamp string
 */
const parseTimestamp = (timeString) => {
  const splitted = timeString.split(':');
  let secondTotal = 0;
  for (let index = splitted.length - 1; index >= 0; index--) {
    const number =
      parseInt(splitted[index]) * Math.pow(60, splitted.length - 1 - index);
    secondTotal += number;
  }
  return secondTotal;
};

/**
 * Creates Video and Contribution nodes from JSON file node
 * @param {function} createNode - Gatsby's createNode function
 * @param {function} createNodeId - Gatsby's createNodeId function
 * @param {function} createContentDigest - Gatsby's createContentDigest function
 * @param {object} node - JSON file node
 * @param {object} parent - Parent node of node
 * @param {string} schemaType - Specific Video node type
 */
const createVideoRelatedNode = (
  createNode,
  createNodeId,
  createContentDigest,
  node,
  parent,
  schemaType
) => {
  const type = camelCaseToDash(schemaType);
  // Loaded node may be a JSON file for a contribution or a video
  if (parent.relativePath.includes('/contributions/')) {
    const data = getJson(node);
    const name = parent.name;
    const newNode = Object.assign({}, data, {
      id: createNodeId(`${type}s/${parent.relativePath}`),
      parent: node.id,
      name,
      video: createNodeId(
        `${type}s/${parent.relativeDirectory.replace('/contributions', '')}`
      ),
      internal: {
        type: `Contribution`,
        contentDigest: createContentDigest(data)
      }
    });
    createNode(newNode);
  } else {
    const slug = parent.relativeDirectory;
    const data = getJson(node);
    // If folder present, it reads every contribution file present in the
    // video folder so that we can get the corresponding ID's to link them
    const contributions = fs.existsSync(`${parent.dir}/contributions`)
      ? fs
          .readdirSync(`${parent.dir}/contributions`)
          .filter((file) => file.includes('.json'))
          .map(
            (file) =>
              `${type}s/${parent.relativeDirectory}/contributions/${file}`
          )
      : [];
    const timestamps = (data.timestamps ?? []).map((timestamp) => ({
      ...timestamp,
      seconds: parseTimestamp(timestamp.time)
    }));

    const newNode = Object.assign({}, data, {
      id: createNodeId(`${type}s/${slug}`),
      parent: node.id,
      slug,
      contributionsPath: `${slug}/contributions`,
      timestamps,
      codeExamples: data.codeExamples ?? [],
      groupLinks: data.groupLinks ?? [],
      canContribute: data.canContribute ?? schemaType === 'Challenge',
      contributions: contributions.map((file) => createNodeId(file)),
      internal: {
        type: schemaType,
        contentDigest: createContentDigest(data)
      }
    });
    createNode(newNode);
  }
};

/**
 * Creates Challenge and Contribution nodes from JSON file node
 * @param {function} createNode - Gatsby's createNode function
 * @param {function} createNodeId - Gatsby's createNodeId function
 * @param {function} createContentDigest - Gatsby's createContentDigest function
 * @param {object} node - JSON file node
 * @param {object} parent - Parent node of node
 */
exports.createChallengeRelatedNode = (
  createNode,
  createNodeId,
  createContentDigest,
  node,
  parent
) =>
  createVideoRelatedNode(
    createNode,
    createNodeId,
    createContentDigest,
    node,
    parent,
    'Challenge'
  );

/**
 * Creates Lesson and Contribution nodes from JSON file node
 * @param {function} createNode - Gatsby's createNode function
 * @param {function} createNodeId - Gatsby's createNodeId function
 * @param {function} createContentDigest - Gatsby's createContentDigest function
 * @param {object} node - JSON file node
 * @param {object} parent - Parent node of node
 */
exports.createLessonRelatedNode = (
  createNode,
  createNodeId,
  createContentDigest,
  node,
  parent
) =>
  createVideoRelatedNode(
    createNode,
    createNodeId,
    createContentDigest,
    node,
    parent,
    'Lesson'
  );

/**
 * Creates Guest Tutorial and Contribution nodes from JSON file node
 * @param {function} createNode - Gatsby's createNode function
 * @param {function} createNodeId - Gatsby's createNodeId function
 * @param {function} createContentDigest - Gatsby's createContentDigest function
 * @param {object} node - JSON file node
 * @param {object} parent - Parent node of node
 */
exports.createGuestTutorialRelatedNode = (
  createNode,
  createNodeId,
  createContentDigest,
  node,
  parent
) =>
  createVideoRelatedNode(
    createNode,
    createNodeId,
    createContentDigest,
    node,
    parent,
    'GuestTutorial'
  );

/**
 * Creates Track node from JSON file node
 * @param {function} createNode - Gatsby's createNode function
 * @param {function} createNodeId - Gatsby's createNodeId function
 * @param {function} createContentDigest - Gatsby's createContentDigest function
 * @param {object} node - JSON file node
 * @param {object} parent - Parent node of node
 */
exports.createTrackRelatedNode = (
  createNode,
  createNodeId,
  createContentDigest,
  node,
  parent
) => {
  const slug = parent.name;
  const id = createNodeId(`tracks/${slug}`);
  const data = getJson(node);
  const { type } = data;
  let numVideos = 0;

  if (type === 'main') {
    // Make Chapter nodes for only main tracks
    const chapters = [];
    if (node.chapters) {
      for (let i = 0; i < node.chapters.length; i++) {
        const chapter = node.chapters[i];
        const data = omit(chapter, ['lessons']);
        const newNode = Object.assign({}, data, {
          id: createNodeId(`${slug}/${data.title}`),
          parent: id,
          track: id,
          lessons: chapter.lessons.map((lessonSlug) =>
            createNodeId(`lessons/${lessonSlug}`)
          ),
          internal: {
            type: `Chapter`,
            contentDigest: createContentDigest(data)
          }
        });
        chapters.push(newNode);
        numVideos += chapter.lessons.length;
      }
    }

    const newNode = Object.assign({}, data, {
      id,
      parent: node.id,
      slug,
      chapters: chapters.map((ch) => ch.id),
      numVideos,
      internal: {
        type: `Track`,
        contentDigest: createContentDigest(data)
      }
    });
    createNode(newNode);

    // Create Chapter nodes
    for (let i = 0; i < chapters.length; i++) {
      createNode(chapters[i]);
    }
  } else if (type === 'side') {
    // Side tracks only reference videos by slug
    numVideos += data.videos.length;
    const newNode = Object.assign({}, data, {
      id,
      parent: node.id,
      slug,
      videos: data.videos.map((videoSlug) => createNodeId(videoSlug)),
      numVideos,
      internal: {
        type: `Track`,
        contentDigest: createContentDigest(data)
      }
    });
    createNode(newNode);
  }
};