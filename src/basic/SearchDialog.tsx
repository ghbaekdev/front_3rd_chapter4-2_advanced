import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Box,
  Button,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from '@chakra-ui/react';
import { useScheduleContext } from './ScheduleContext.tsx';
import { Lecture } from './types.ts';
import { parseSchedule } from './utils.ts';
import { cachedFetchLiberalArts, cachedFetchMajors } from './apis.ts';
import { useSearchFilters } from './hooks/useSearchFilter.ts';
import {
  CreditFilter,
  DaysFilter,
  GradeFilter,
  MajorFilter,
  QueryFilter,
  TimeFilter,
} from './components/filters';

interface Props {
  searchInfo: {
    tableId: string;
    day?: string;
    time?: number;
  } | null;
  onClose: () => void;
}

const PAGE_SIZE = 100;

// TODO: 이 코드를 개선해서 API 호출을 최소화 해보세요 + Promise.all이 현재 잘못 사용되고 있습니다. 같이 개선해주세요.
const fetchAllLectures = async () =>
  await Promise.all([
    (console.log('API Call 1', performance.now()), cachedFetchMajors()),
    (console.log('API Call 2', performance.now()), cachedFetchLiberalArts()),
    (console.log('API Call 3', performance.now()), cachedFetchMajors()),
    (console.log('API Call 4', performance.now()), cachedFetchLiberalArts()),
    (console.log('API Call 5', performance.now()), cachedFetchMajors()),
    (console.log('API Call 6', performance.now()), cachedFetchLiberalArts()),
  ]);

// TODO: 이 컴포넌트에서 불필요한 연산이 발생하지 않도록 다양한 방식으로 시도해주세요.
const SearchDialog = ({ searchInfo, onClose }: Props) => {
  const { handleAddSchedule } = useScheduleContext();

  const loaderWrapperRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [page, setPage] = useState(1);
  const { searchOption, handlers, setInitialState } = useSearchFilters();
  const { query, credits, grades, days, times, majors } = searchOption;
  const {
    handleChangeQuery,
    handleChangeCredits,
    handleChangeGrades,
    handleChangeDays,
    handleChangeTimes,
    handleChangeMajors,
  } = handlers;

  const getFilteredLectures = useCallback(() => {
    const searchRegex = query ? new RegExp(query, 'i') : null;

    return lectures.filter((lecture) => {
      if (
        searchRegex &&
        !searchRegex.test(lecture.title) &&
        !searchRegex.test(lecture.id)
      ) {
        return false;
      }

      if (grades.length > 0 && !grades.includes(lecture.grade)) {
        return false;
      }

      if (majors.length > 0 && !majors.includes(lecture.major)) {
        return false;
      }

      if (credits && !lecture.credits.startsWith(String(credits))) {
        return false;
      }

      if (days.length > 0 || times.length > 0) {
        const schedules = lecture.schedule
          ? parseSchedule(lecture.schedule)
          : [];

        if (days.length > 0 && !schedules.some((s) => days.includes(s.day))) {
          return false;
        }

        if (
          times.length > 0 &&
          !schedules.some((s) => s.range.some((time) => times.includes(time)))
        ) {
          return false;
        }
      }

      return true;
    });
  }, [query, credits, grades, days, times, majors, lectures]);
  const filteredLectures = useMemo(getFilteredLectures, [getFilteredLectures]);

  const lastPage = useMemo(
    () => Math.ceil(filteredLectures.length / PAGE_SIZE),
    [filteredLectures]
  );
  const visibleLectures = useMemo(
    () => filteredLectures.slice(0, page * PAGE_SIZE),
    [filteredLectures, page]
  );
  const allMajors = useMemo(
    () => [...new Set(lectures.map((lecture) => lecture.major))],
    [lectures]
  );

  const addSchedule = useCallback(
    (lecture: Lecture) => {
      if (!searchInfo) return;

      const { tableId } = searchInfo;

      const schedules = parseSchedule(lecture.schedule).map((schedule) => ({
        ...schedule,
        lecture,
      }));

      handleAddSchedule(tableId, schedules);

      onClose();
    },
    [handleAddSchedule, searchInfo, onClose]
  );

  useEffect(() => {
    const start = performance.now();
    console.log('API 호출 시작: ', start);
    fetchAllLectures().then((results) => {
      const end = performance.now();
      console.log('모든 API 호출 완료 ', end);
      console.log('API 호출에 걸린 시간(ms): ', end - start);
      setLectures(results.flatMap((result) => result.data));
    });
  }, []);

  useEffect(() => {
    const $loader = loaderRef.current;
    const $loaderWrapper = loaderWrapperRef.current;

    if (!$loader || !$loaderWrapper) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPage((prevPage) => Math.min(lastPage, prevPage + 1));
        }
      },
      { threshold: 0, root: $loaderWrapper }
    );

    observer.observe($loader);

    return () => observer.unobserve($loader);
  }, [lastPage]);

  useEffect(() => {
    setInitialState({
      days: searchInfo?.day ? [searchInfo.day] : [],
      times: searchInfo?.time ? [searchInfo.time] : [],
    });
    setPage(1);
  }, [setInitialState, searchInfo]);

  return (
    <Modal isOpen={Boolean(searchInfo)} onClose={onClose} size="6xl">
      <ModalOverlay />
      <ModalContent maxW="90vw" w="1000px">
        <ModalHeader>수업 검색</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <HStack spacing={4}>
              <QueryFilter value={query} onChange={handleChangeQuery} />

              <CreditFilter
                value={credits?.toString()}
                onChange={handleChangeCredits}
              />
            </HStack>

            <HStack spacing={4}>
              <GradeFilter value={grades} onChange={handleChangeGrades} />
              <DaysFilter value={days} onChange={handleChangeDays} />
            </HStack>

            <HStack spacing={4}>
              <TimeFilter value={times} onChange={handleChangeTimes} />

              <MajorFilter
                value={majors}
                onChange={handleChangeMajors}
                allMajors={allMajors}
              />
            </HStack>

            <Text align="right">검색결과: {filteredLectures.length}개</Text>
            <Box>
              <Table>
                <Thead>
                  <Tr>
                    <Th width="100px">과목코드</Th>
                    <Th width="50px">학년</Th>
                    <Th width="200px">과목명</Th>
                    <Th width="50px">학점</Th>
                    <Th width="150px">전공</Th>
                    <Th width="150px">시간</Th>
                    <Th width="80px"></Th>
                  </Tr>
                </Thead>
              </Table>

              <Box overflowY="auto" maxH="500px" ref={loaderWrapperRef}>
                <Table size="sm" variant="striped">
                  <Tbody>
                    {visibleLectures.map((lecture, index) => (
                      <Tr key={`${lecture.id}-${index}`}>
                        <Td width="100px">{lecture.id}</Td>
                        <Td width="50px">{lecture.grade}</Td>
                        <Td width="200px">{lecture.title}</Td>
                        <Td width="50px">{lecture.credits}</Td>
                        <Td
                          width="150px"
                          dangerouslySetInnerHTML={{ __html: lecture.major }}
                        />
                        <Td
                          width="150px"
                          dangerouslySetInnerHTML={{ __html: lecture.schedule }}
                        />
                        <Td width="80px">
                          <Button
                            size="sm"
                            colorScheme="green"
                            onClick={() => addSchedule(lecture)}
                          >
                            추가
                          </Button>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
                <Box ref={loaderRef} h="20px" />
              </Box>
            </Box>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default SearchDialog;
