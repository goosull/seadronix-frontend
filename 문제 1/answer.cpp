/**
 * 문제에 제시된 대로 재귀 호출을 통해 피보나치 수열을 계산한다면
 * 시간 복잡도가 O(2^N)이 되어 매우 비효율적입니다.
 * 따라서 동적 계획법(DP)을 사용하여 O(N) 시간 복잡도로 해결합니다.
 */
#include <iostream>
#include <vector>
using namespace std;

int main() {
    // C++의 빠른 입출력을 위한 설정
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    // 최대 N = 40
    const int MAXN = 40;
    vector<int> zero(MAXN + 1), one(MAXN + 1);

    // 기본값 설정
    zero[0] = 1;
    one[0] = 0;
    zero[1] = 0;
    one[1] = 1;

    // DP로 2부터 40까지 계산
    for (int i = 2; i <= MAXN; ++i) {
        zero[i] = zero[i - 1] + zero[i - 2];
        one[i] = one[i - 1] + one[i - 2];
    }

    int T;
    cin >> T;
    while (T--) {
        int N;
        cin >> N;
        // N번째 호출 시 0이 출력되는 횟수, 1이 출력되는 횟수
        cout << zero[N] << ' ' << one[N] << '\n';
    }

    return 0;
}