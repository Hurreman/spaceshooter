export interface Score {
    name: string;
    score: number;
    scoreDate?: string;
}

export async function postHighScore( scoreData: Score ) {
    try {
        const result = await fetch( '/api/highscores', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(scoreData)
        });
    
        return result;
    }
    catch( error ) {
        return false;
    }
}

export async function fetchHighScores() {
    const result = await fetch( '/api/highscores' );
    return result;
}