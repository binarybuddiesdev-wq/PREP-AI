export interface ISeedTopic {
  name: string;
  slug: string;
  category: 'practice' | 'coding';
  icon: string;
}

export interface ISeedQuestion {
  topicSlug: string;
  question: string;
  difficulty: 'Junior' | 'Mid' | 'Senior';
  referenceAnswer: string;
}
